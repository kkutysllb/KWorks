import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  FileEffectResultStore,
  InMemoryEffectResultStore,
  InMemoryRunEventStore
} from '@qiongqi/adapter-storage'
import type { RunIdentity } from '@qiongqi/contracts'
import { digestValue, EffectCommitCoordinator, ToolRuntimeV3 } from '@qiongqi/loop'
import type { ToolHost, ToolHostContext } from '@qiongqi/ports'

const identity: RunIdentity = {
  ownerUserId: 'owner-1',
  workspaceKey: '/workspace-1',
  threadId: 'thread-1',
  turnId: 'turn-1',
  runId: 'run-1'
}

describe('EffectResultStore', () => {
  it('replays a committed result after the coordinator process is replaced', async () => {
    const root = await mkdtemp(join(tmpdir(), 'qiongqi-effect-results-'))
    const results = new FileEffectResultStore(root)
    const events = new InMemoryRunEventStore()
    const counter = { value: 0 }
    const firstRuntime = new ToolRuntimeV3({
      toolHost: host(counter),
      effects: new EffectCommitCoordinator({ events, results })
    })
    const first = await firstRuntime.execute({
      identity,
      state: state(),
      call: { callId: 'call-1', toolName: 'write', arguments: { value: 1 } },
      context,
      policy: { effect: 'idempotent-write', replay: 'verify-first' }
    })

    const secondRuntime = new ToolRuntimeV3({
      toolHost: host(counter),
      effects: new EffectCommitCoordinator({ events, results: new FileEffectResultStore(root) })
    })
    const second = await secondRuntime.execute({
      identity,
      state: first.state,
      call: { callId: 'call-1', toolName: 'write', arguments: { value: 1 } },
      context,
      policy: { effect: 'idempotent-write', replay: 'verify-first' }
    })

    expect(counter.value).toBe(1)
    expect(second.replayed).toBe(true)
    expect(second.result).toEqual(first.result)
  })

  it('isolates equal idempotency keys by full run identity', async () => {
    const store = new InMemoryEffectResultStore()
    await store.save(identity, 'same-key', digestValue({ ok: true }), { ok: true })
    await expect(store.load({ ...identity, ownerUserId: 'owner-2' }, 'same-key')).resolves.toBeUndefined()
    await expect(store.load({ ...identity, workspaceKey: '/workspace-2' }, 'same-key')).resolves.toBeUndefined()
  })

  it('rejects a file whose persisted result no longer matches its digest', async () => {
    const root = await mkdtemp(join(tmpdir(), 'qiongqi-effect-tamper-'))
    const store = new FileEffectResultStore(root)
    const digest = digestValue({ ok: true })
    await store.save(identity, 'call-key', digest, { ok: true })
    await writeFile(store.resultPath(identity, 'call-key'), JSON.stringify({ resultDigest: digest, result: { ok: false } }), 'utf8')
    await expect(store.load(identity, 'call-key')).rejects.toThrow('effect result digest mismatch')
  })

  it('does not synthesize an observation for a legacy plain stored result', async () => {
    const results = new InMemoryEffectResultStore()
    const effects = new EffectCommitCoordinator({ events: new InMemoryRunEventStore(), results })
    const key = effects.idempotencyKey(identity, 'legacy-call')
    const legacyResult = await host({ value: 0 }).execute({
      callId: 'legacy-call',
      toolName: 'write',
      arguments: { path: 'original.txt' }
    }, context)
    await results.save(identity, key, digestValue(legacyResult), legacyResult)
    const runtime = new ToolRuntimeV3({ toolHost: host({ value: 0 }), effects })
    const current = state()
    current.committedEffects.push({
      idempotencyKey: key,
      resultDigest: digestValue(legacyResult),
      status: 'committed',
      committedAt: 'now'
    })
    const replay = await runtime.execute({
      identity,
      state: current,
      call: { callId: 'legacy-call', toolName: 'bash', arguments: { command: 'changed' } },
      context,
      policy: { effect: 'idempotent-write', replay: 'verify-first' }
    })
    expect(replay.result).toEqual(legacyResult)
    expect(replay.observation).toBeUndefined()
  })

  it('replays normalized special values identically from file and memory stores', async () => {
    async function run(results: InMemoryEffectResultStore | FileEffectResultStore) {
      const runtime = new ToolRuntimeV3({
        toolHost: specialValueHost(),
        effects: new EffectCommitCoordinator({ events: new InMemoryRunEventStore(), results })
      })
      const input = {
        identity,
        state: state(),
        call: { callId: 'special', toolName: 'special', arguments: {} },
        context,
        policy: { effect: 'read' as const, replay: 'safe' as const }
      }
      const first = await runtime.execute(input)
      const replay = await runtime.execute({ ...input, state: first.state })
      return { first, replay }
    }
    const file = await run(new FileEffectResultStore(await mkdtemp(join(tmpdir(), 'qiongqi-special-file-'))))
    const memory = await run(new InMemoryEffectResultStore())
    expect(file.first.result).toEqual(memory.first.result)
    expect(file.first.observation).toEqual(memory.first.observation)
    expect(file.replay.result).toEqual(file.first.result)
    expect(memory.replay.result).toEqual(memory.first.result)
  })

  it('replays cyclic output failures identically from file and memory stores', async () => {
    async function run(results: InMemoryEffectResultStore | FileEffectResultStore) {
      const runtime = new ToolRuntimeV3({
        toolHost: cyclicValueHost(),
        effects: new EffectCommitCoordinator({ events: new InMemoryRunEventStore(), results })
      })
      return runtime.execute({
        identity,
        state: state(),
        call: { callId: 'cyclic', toolName: 'cyclic', arguments: {} },
        context,
        policy: { effect: 'read', replay: 'safe' }
      })
    }
    const file = await run(new FileEffectResultStore(await mkdtemp(join(tmpdir(), 'qiongqi-cyclic-file-'))))
    const memory = await run(new InMemoryEffectResultStore())
    expect(file.result).toEqual(memory.result)
    expect(file.observation).toEqual(memory.observation)
  })

  it('rejects a stored runtime wrapper with an invalid observation schema', async () => {
    const root = await mkdtemp(join(tmpdir(), 'qiongqi-invalid-wrapper-'))
    const results = new FileEffectResultStore(root)
    const runtime = new ToolRuntimeV3({
      toolHost: host({ value: 0 }),
      effects: new EffectCommitCoordinator({ events: new InMemoryRunEventStore(), results })
    })
    const input = {
      identity,
      state: state(),
      call: { callId: 'invalid-wrapper', toolName: 'write', arguments: {} },
      context,
      policy: { effect: 'idempotent-write' as const, replay: 'verify-first' as const }
    }
    const first = await runtime.execute(input)
    const key = `owner-1:/workspace-1:run-1:invalid-wrapper`
    const path = results.resultPath(identity, key)
    const stored = JSON.parse(await readFile(path, 'utf8')) as { resultDigest: string; result: Record<string, unknown> }
    stored.result.observation = { replayed: false }
    stored.resultDigest = digestValue(stored.result)
    await writeFile(path, JSON.stringify(stored), 'utf8')
    await expect(runtime.execute({ ...input, state: first.state })).rejects.toThrow(/stored tool runtime/i)
  })
})

const context = {
  threadId: identity.threadId,
  turnId: identity.turnId,
  workspace: identity.workspaceKey,
  approvalPolicy: 'trusted',
  abortSignal: new AbortController().signal,
  awaitApproval: async () => 'allow'
} as ToolHostContext

function host(counter: { value: number }): ToolHost {
  return {
    id: 'test',
    async listTools() { return [] },
    async execute(call) {
      counter.value += 1
      return {
        approved: true,
        item: {
          id: `result-${call.callId}`,
          threadId: identity.threadId,
          turnId: identity.turnId,
          role: 'tool',
          status: 'completed',
          createdAt: 'now',
          kind: 'tool_result',
          toolName: call.toolName,
          callId: call.callId,
          toolKind: 'tool_call',
          output: { count: counter.value },
          isError: false
        }
      }
    }
  }
}

function specialValueHost(): ToolHost {
  return {
    id: 'special',
    async listTools() { return [] },
    async execute(call) {
      const sparse: unknown[] = []
      sparse.length = 2
      sparse[1] = undefined
      return {
        approved: true,
        item: {
          id: `result-${call.callId}`,
          threadId: identity.threadId,
          turnId: identity.turnId,
          role: 'tool',
          status: 'completed',
          createdAt: 'now',
          kind: 'tool_result',
          toolName: call.toolName,
          callId: call.callId,
          toolKind: 'tool_call',
          output: {
            date: new Date('2026-07-17T00:00:00.000Z'),
            missing: undefined,
            nan: Number.NaN,
            infinity: Number.POSITIVE_INFINITY,
            negativeZero: -0,
            bigint: 42n,
            sparse
          },
          isError: false
        }
      }
    }
  }
}

function cyclicValueHost(): ToolHost {
  return {
    id: 'cyclic',
    async listTools() { return [] },
    async execute(call) {
      const output: Record<string, unknown> = { ok: true }
      output.self = output
      return {
        approved: true,
        item: {
          id: `result-${call.callId}`,
          threadId: identity.threadId,
          turnId: identity.turnId,
          role: 'tool',
          status: 'completed',
          createdAt: 'now',
          kind: 'tool_result',
          toolName: call.toolName,
          callId: call.callId,
          toolKind: 'tool_call',
          output,
          isError: false
        }
      }
    }
  }
}

function state() {
  return {
    version: 3 as const,
    graphVersion: 'test',
    runtimeMode: 'kernel_v3' as const,
    ...identity,
    status: 'running' as const,
    cursor: { stepIndex: 0, nodeId: 'tool', attempt: 0, checkpointSeq: 0 },
    budgets: { stepsUsed: 0, toolCallsUsed: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
    recovery: { attempts: 0, maxAttempts: 1 },
    middleware: {},
    nodeData: {},
    taskRevision: 0,
    pendingEffects: [],
    committedEffects: [],
    createdAt: 'now',
    updatedAt: 'now'
  }
}
