import { describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { InMemorySessionStore } from '@qiongqi/adapter-storage'
import { InMemoryThreadStore } from '@qiongqi/adapter-storage'
import { createThreadRecord } from '@qiongqi/domain'
import { UsageService } from '@qiongqi/services'
import { createAgent, seedUsageCarryover } from '@qiongqi/http'
import { DEFAULT_QIONGQI_CAPABILITIES_CONFIG, type UsageSnapshot } from '@qiongqi/contracts'

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
