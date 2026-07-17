import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  FileRunEventStore,
  FileRunStateStore,
  InMemorySessionStore,
  InMemoryThreadStore
} from '@qiongqi/adapter-storage'
import { createImmutablePrefix } from '@qiongqi/cache'
import { createThreadRecord } from '@qiongqi/domain'
import { UsageService } from '@qiongqi/services'
import {
  createAgent,
  createCore,
  createKernelV3TurnRunner,
  createModelAdapter,
  seedUsageCarryover
} from '@qiongqi/http'
import { DEFAULT_QIONGQI_CAPABILITIES_CONFIG, type UsageSnapshot } from '@qiongqi/contracts'
import type { ModelClient, ModelRequest, ModelStreamChunk } from '@qiongqi/ports'
import { PromptBuilder, modelCapabilitiesForModel } from '@qiongqi/loop'

function usage(overrides: Partial<UsageSnapshot>): UsageSnapshot {
  const promptTokens = overrides.promptTokens ?? 10
  const completionTokens = overrides.completionTokens ?? 5
  const cacheHitTokens = overrides.cacheHitTokens ?? 0
  const cacheMissTokens = overrides.cacheMissTokens ?? Math.max(promptTokens - cacheHitTokens, 0)
  const cacheTotal = cacheHitTokens + cacheMissTokens
  return {
    promptTokens,
    completionTokens,
    totalTokens: overrides.totalTokens ?? promptTokens + completionTokens,
    cachedTokens: overrides.cachedTokens ?? cacheHitTokens,
    cacheHitTokens,
    cacheMissTokens,
    cacheHitRate: cacheTotal === 0 ? null : cacheHitTokens / cacheTotal,
    turns: overrides.turns ?? 1,
    ...(overrides.costUsd !== undefined ? { costUsd: overrides.costUsd } : {})
  }
}

function modelRequest(model: string, abortSignal: AbortSignal): ModelRequest {
  return {
    threadId: 'thr_timeout',
    turnId: 'turn_timeout',
    model,
    systemPrompt: 'Be brief.',
    prefix: [],
    history: [],
    tools: [],
    abortSignal
  }
}

async function collectUntilError(stream: AsyncIterable<ModelStreamChunk>): Promise<ModelStreamChunk[]> {
  const chunks: ModelStreamChunk[] = []
  for await (const chunk of stream) {
    chunks.push(chunk)
    if (chunk.kind === 'error') break
  }
  return chunks
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('runtime info().model follows live configStore serve.model', () => {
  it('reflects an activate-style serve.model write without a restart', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'runtime-dynamic-model-'))
    const dataDir = join(dir, 'data')
    const configPath = join(dir, 'qiongqi-config.json')
    let runtime: Awaited<ReturnType<typeof createAgent>> | undefined

    try {
      runtime = await createAgent({
        host: '127.0.0.1',
        port: 0,
        configPath,
        dataDir,
        runtimeToken: 'tok',
        apiKey: '',
        baseUrl: 'https://api.example.test/v1',
        endpointFormat: 'chat_completions',
        model: 'deepseek-chat',
        approvalPolicy: 'on-request',
        sandboxMode: 'workspace-write',
        tokenEconomyMode: false,
        insecure: true,
        storage: { backend: 'file' }
      })

      // At startup info().model equals the option.
      expect(runtime.info().model).toBe('deepseek-chat')

      // Simulate an `activateModel` write (single-machine/runtime-token path):
      // the fallback branch of kworksActivateModel rewrites serve.model via
      // configStore.write(). info().model must pick up the new value on the
      // next call, without a process restart.
      const current = runtime.configStore?.snapshot()
      expect(current).toBeTruthy()
      await runtime.configStore?.write({
        ...(current as NonNullable<typeof current>),
        serve: {
          ...(current as NonNullable<typeof current>).serve,
          model: 'glm-5.2'
        }
      })

      expect(runtime.info().model).toBe('glm-5.2')
    } finally {
      await runtime?.shutdown?.()
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('runtime model adapter tuning', () => {
  it('passes runtime modelStreamIdleTimeoutMs into routed model profiles', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(new ReadableStream<Uint8Array>({
        start() {
          // Intentionally leave the stream open without chunks.
        }
      }), { status: 200, headers: { 'content-type': 'text/event-stream' } })
    ))
    const controller = new AbortController()
    const adapter = createModelAdapter({
      baseUrl: 'https://fallback.example/v1',
      apiKey: 'fallback-key',
      endpointFormat: 'chat_completions',
      model: 'fallback-model',
      models: {
        profiles: {
          'zhipu-glm': {
            providerModel: 'glm-5.2',
            baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
            apiKey: 'zhipu-key',
            endpointFormat: 'chat_completions'
          }
        }
      },
      runtime: { modelStreamIdleTimeoutMs: 5 }
    })

    const result = await Promise.race([
      collectUntilError(adapter.client.stream(modelRequest('zhipu-glm', controller.signal))),
      new Promise<'timed-out'>((resolve) => setTimeout(() => resolve('timed-out'), 50))
    ])
    controller.abort()

    expect(result).not.toBe('timed-out')
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'error', code: 'stream_idle_timeout' })
      ])
    )
  })
})

describe('runtime factory usage carryover', () => {
  it('seeds runtime usage from the latest persisted cumulative usage event per thread', async () => {
    const threadStore = new InMemoryThreadStore()
    const sessionStore = new InMemorySessionStore()
    const usageService = new UsageService()
    await threadStore.upsert(createThreadRecord({
      id: 'thr_seed',
      title: 'Seeded thread',
      workspace: '/tmp/project',
      model: 'deepseek-chat'
    }))
    await sessionStore.appendEvent('thr_seed', {
      kind: 'usage',
      seq: 2,
      timestamp: '2026-06-02T09:00:00.000Z',
      threadId: 'thr_seed',
      usage: usage({ promptTokens: 20, completionTokens: 5, cacheHitTokens: 10, cacheMissTokens: 10, turns: 1 })
    })
    await sessionStore.appendEvent('thr_seed', {
      kind: 'usage',
      seq: 5,
      timestamp: '2026-06-02T09:05:00.000Z',
      threadId: 'thr_seed',
      usage: usage({ promptTokens: 80, completionTokens: 20, cacheHitTokens: 72, cacheMissTokens: 8, turns: 3 })
    })

    await seedUsageCarryover({ threadStore, sessionStore, usageService })

    expect(usageService.forThread('thr_seed')).toMatchObject({
      promptTokens: 80,
      completionTokens: 20,
      totalTokens: 100,
      cacheHitTokens: 72,
      cacheMissTokens: 8,
      turns: 3
    })
    expect(usageService.cacheSnapshot('thr_seed')).toMatchObject({
      hits: 72,
      misses: 8,
      hitRate: 0.9
    })
  })
})

describe('kernel runtime factory usage accounting', () => {
  it('records the latest cumulative model usage once across runtime observers', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'runtime-kernel-usage-'))
    const dataDir = join(dir, 'data')
    const runtimeV3Root = join(dir, 'runtime-v3')
    const core = await createCore({ dataDir, storage: { backend: 'file' } })
    const pressure = vi.spyOn(PromptBuilder.prototype, 'recordPromptPressure')
    try {
      const thread = await core.threadService.create({
        workspace: dir,
        model: 'test-model'
      }, {
        id: 'thread-kernel-usage'
      })
      const started = await core.turnService.startTurn({
        threadId: thread.id,
        request: { prompt: 'report usage' }
      })
      const first = usage({ promptTokens: 10, completionTokens: 2, totalTokens: 12 })
      const latest = usage({ promptTokens: 10, completionTokens: 5, totalTokens: 15 })
      const modelClient: ModelClient = {
        provider: 'test-provider',
        model: 'test-model',
        async *stream() {
          yield { kind: 'usage', usage: first }
          yield { kind: 'assistant_text_delta', text: 'done' }
          yield { kind: 'usage', usage: latest }
          yield { kind: 'completed', stopReason: 'stop' }
        }
      }
      const runEvents = new FileRunEventStore(runtimeV3Root)
      const runner = createKernelV3TurnRunner({
        options: {
          dataDir,
          model: 'test-model',
          endpointFormat: 'chat_completions',
          approvalPolicy: 'trusted',
          sandboxMode: 'workspace-write',
          capabilities: DEFAULT_QIONGQI_CAPABILITIES_CONFIG
        } as never,
        core,
        model: {
          modelCapabilities: () => modelCapabilitiesForModel('test-model')
        } as never,
        modelClient,
        tools: {
          toolHost: {
            id: 'empty-tools',
            listTools: async () => [],
            execute: async () => { throw new Error('no tools expected') }
          }
        } as never,
        prefix: createImmutablePrefix({ systemPrompt: 'be brief' }),
        tokenEconomy: undefined as never,
        runtimeV3Root,
        events: runEvents,
        toolRuntime: {} as never
      })

      const status = await runner.runTurn(thread.id, started.turnId)
      const runIdentity = {
        ownerUserId: 'local-default-owner',
        workspaceKey: dir,
        threadId: thread.id,
        turnId: started.turnId,
        runId: `run_${thread.id}_${started.turnId}`
      }
      const persistedRun = await new FileRunStateStore(runtimeV3Root).load(runIdentity)
      expect(status, JSON.stringify(persistedRun?.outcome)).toBe('completed')

      expect(core.usageService.forThread(thread.id)).toMatchObject({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15
      })
      const usageEvents = (await core.sessionStore.loadEventsSince(thread.id, 0)).filter(
        (event) => event.kind === 'usage'
      )
      expect(usageEvents).toEqual([
        expect.objectContaining({
          kind: 'usage',
          usage: expect.objectContaining({ promptTokens: 10, completionTokens: 5, totalTokens: 15 })
        })
      ])
      expect(pressure).toHaveBeenCalledTimes(1)
      expect(pressure).toHaveBeenCalledWith(
        expect.objectContaining({ threadId: thread.id, turnId: started.turnId }),
        'test-model',
        10
      )
      expect(persistedRun).toMatchObject({
        budgets: { stepsUsed: 1, inputTokens: 10, outputTokens: 5 }
      })
    } finally {
      pressure.mockRestore()
      await core.storesShutdown?.()
      core.userDataShutdown?.()
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('runtime skill roots', () => {
  it('keeps runtime-mounted skill roots when config refresh reads empty persisted roots', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'runtime-skill-roots-'))
    const dataDir = join(dir, 'data')
    const skillsRoot = join(dir, 'skills')
    const configPath = join(dir, 'qiongqi-config.json')
    const skillDir = join(skillsRoot, 'runtime-mounted-skill')
    let runtime: Awaited<ReturnType<typeof createAgent>> | undefined

    try {
      await mkdir(skillDir, { recursive: true })
      await writeFile(
        join(skillDir, 'SKILL.md'),
        '---\nname: Runtime Mounted Skill\ndescription: mounted by serve env\n---\nRuntime mounted instructions.\n',
        'utf8'
      )
      await writeFile(
        configPath,
        JSON.stringify({
          capabilities: {
            skills: {
              enabled: true,
              roots: [],
              legacySkillMd: true
            }
          }
        }),
        'utf8'
      )

      runtime = await createAgent({
        host: '127.0.0.1',
        port: 0,
        configPath,
        dataDir,
        runtimeToken: 'tok',
        apiKey: '',
        baseUrl: 'https://api.example.test/v1',
        endpointFormat: 'chat_completions',
        model: 'deepseek-chat',
        approvalPolicy: 'on-request',
        sandboxMode: 'workspace-write',
        tokenEconomyMode: false,
        insecure: true,
        storage: { backend: 'file' },
        capabilities: {
          ...DEFAULT_QIONGQI_CAPABILITIES_CONFIG,
          skills: {
            ...DEFAULT_QIONGQI_CAPABILITIES_CONFIG.skills,
            enabled: true,
            roots: [skillsRoot],
            legacySkillMd: true
          }
        }
      })

      expect((await runtime.skillsV2?.())?.skills.map((skill) => skill.id)).toContain('runtime-mounted-skill')

      await runtime.configStore?.read()
      await runtime.refreshRuntimeTools?.()

      expect((await runtime.skillsV2?.())?.skills.map((skill) => skill.id)).toContain('runtime-mounted-skill')
    } finally {
      await runtime?.shutdown?.()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('does not report duplicate skills when runtime-mounted roots already contain bundled skills', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'runtime-skill-duplicates-'))
    const dataDir = join(dir, 'data')
    const skillsRoot = join(dir, 'skills')
    const mountedSkillDir = join(skillsRoot, 'shared-skill')
    const bundledSkillDir = join(dataDir, 'builtin-skills', 'shared-skill')
    let runtime: Awaited<ReturnType<typeof createAgent>> | undefined

    try {
      await mkdir(mountedSkillDir, { recursive: true })
      await mkdir(bundledSkillDir, { recursive: true })
      await writeFile(
        join(mountedSkillDir, 'SKILL.md'),
        '---\nname: Shared Skill\n---\nMounted instructions.\n',
        'utf8'
      )
      await writeFile(
        join(bundledSkillDir, 'SKILL.md'),
        '---\nname: Shared Skill\n---\nBundled instructions.\n',
        'utf8'
      )

      runtime = await createAgent({
        host: '127.0.0.1',
        port: 0,
        dataDir,
        runtimeToken: 'tok',
        apiKey: '',
        baseUrl: 'https://api.example.test/v1',
        endpointFormat: 'chat_completions',
        model: 'deepseek-chat',
        approvalPolicy: 'on-request',
        sandboxMode: 'workspace-write',
        tokenEconomyMode: false,
        insecure: true,
        storage: { backend: 'file' },
        capabilities: {
          ...DEFAULT_QIONGQI_CAPABILITIES_CONFIG,
          skills: {
            ...DEFAULT_QIONGQI_CAPABILITIES_CONFIG.skills,
            enabled: true,
            roots: [skillsRoot],
            legacySkillMd: true
          }
        }
      })

      const diagnostics = await runtime.skillsV2?.()
      expect(diagnostics?.skills.map((skill) => skill.id)).toContain('shared-skill')
      expect(diagnostics?.validationErrors).not.toContainEqual(
        expect.objectContaining({ message: 'duplicate Skill id: shared-skill' })
      )
    } finally {
      await runtime?.shutdown?.()
      await rm(dir, { recursive: true, force: true })
    }
  })
})
