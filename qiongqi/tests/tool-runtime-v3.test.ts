import { describe, expect, it } from 'vitest'
import { canonicalToolDigest, digestValue, EffectCommitCoordinator, ToolRuntimeV3 } from '@qiongqi/loop'
import { InMemoryEffectResultStore, InMemoryRunEventStore } from '@qiongqi/adapter-storage'
import { LocalToolHost } from '@qiongqi/adapter-tools'
import type { RunIdentity, RunStateV3 } from '@qiongqi/contracts'
import type { ToolHost, ToolHostContext, ToolHostResult } from '@qiongqi/ports'

const identity: RunIdentity = { ownerUserId: 'u1', workspaceKey: 'w1', threadId: 't1', turnId: 'tu1', runId: 'r1' }
const state: RunStateV3 = { version: 3, graphVersion: 'g1', runtimeMode: 'kernel_v3', ...identity, status: 'running', cursor: { stepIndex: 1, nodeId: 'tool', attempt: 0, checkpointSeq: 0 }, budgets: { stepsUsed: 0, toolCallsUsed: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 }, recovery: { attempts: 0, maxAttempts: 1 }, middleware: {}, pendingEffects: [], committedEffects: [], createdAt: '2026-07-15T00:00:00.000Z', updatedAt: '2026-07-15T00:00:00.000Z' }
const context = { threadId: 't1', turnId: 'tu1', workspace: '/tmp', approvalPolicy: 'trusted', abortSignal: new AbortController().signal, awaitApproval: async () => 'allow' as const } as ToolHostContext

function toolResult(input: { isError?: boolean; status?: 'completed' | 'failed'; itemId?: string } = {}): ToolHostResult {
  return {
    approved: true,
    item: {
      id: input.itemId ?? 'item-c1',
      turnId: 'tu1',
      threadId: 't1',
      role: 'tool',
      status: input.status ?? 'completed',
      createdAt: '2026-07-15T00:00:00.000Z',
      finishedAt: '2026-07-15T00:00:01.000Z',
      kind: 'tool_result',
      toolName: 'write',
      callId: 'c1',
      toolKind: 'file_change',
      output: { path: '/tmp/report.txt', bytes: 4 },
      isError: input.isError ?? false
    },
    semantic: {
      capabilityClass: 'file.write',
      resourceKeys: ['report.txt'],
      artifactRefs: [{ path: 'report.txt', kind: 'file', producedByCallId: 'c1' }]
    }
  }
}

function host(counter: { value: number }, result: ToolHostResult = toolResult()): ToolHost {
  return { id: 'test', async listTools() { return [] }, async execute() { counter.value += 1; return result } }
}

describe('ToolRuntimeV3', () => {
  it('replays idempotent writes without executing twice', async () => {
    const counter = { value: 0 }
    const runtime = new ToolRuntimeV3({ toolHost: host(counter), effects: new EffectCommitCoordinator({ events: new InMemoryRunEventStore(), results: new InMemoryEffectResultStore() }) })
    const input = { identity, state, call: { callId: 'c1', toolName: 'write', arguments: {} }, context, policy: { effect: 'idempotent-write' as const, replay: 'verify-first' as const } }
    const first = await runtime.execute(input)
    const second = await runtime.execute({ ...input, state: first.state })
    expect(counter.value).toBe(1)
    expect(first.observation).toMatchObject({
      callId: 'c1',
      toolName: 'write',
      effect: 'idempotent-write',
      capabilityClass: 'file.write',
      resourceKeys: ['report.txt'],
      resultItemId: 'item-c1',
      replayed: false,
      failed: false
    })
    expect(second.replayed).toBe(true)
    expect(second.observation).toMatchObject({ replayed: true })
    expect(second.observation?.canonicalArgumentsDigest).toBe(first.observation?.canonicalArgumentsDigest)
    expect(second.observation?.resultDigest).toBe(first.observation?.resultDigest)
  })

  it('observes a committed failed tool result', async () => {
    const counter = { value: 0 }
    const runtime = new ToolRuntimeV3({
      toolHost: host(counter, toolResult({ isError: true, status: 'failed', itemId: 'item-failed' })),
      effects: new EffectCommitCoordinator({ events: new InMemoryRunEventStore(), results: new InMemoryEffectResultStore() })
    })
    const result = await runtime.execute({
      identity,
      state,
      call: { callId: 'c1', toolName: 'write', toolKind: 'file_change', arguments: { path: 'report.txt' } },
      context,
      policy: { effect: 'idempotent-write', replay: 'verify-first' }
    })
    expect(result.observation).toMatchObject({ failed: true, resultItemId: 'item-failed', replayed: false })
  })

  it('replays the original observation when call metadata changes for the same callId', async () => {
    const counter = { value: 0 }
    const runtime = new ToolRuntimeV3({
      toolHost: host(counter),
      effects: new EffectCommitCoordinator({ events: new InMemoryRunEventStore(), results: new InMemoryEffectResultStore() })
    })
    const first = await runtime.execute({
      identity,
      state,
      call: {
        callId: 'c1',
        toolName: 'write',
        providerId: 'builtin',
        toolKind: 'file_change',
        arguments: { path: 'report.txt' }
      },
      context,
      policy: { effect: 'idempotent-write', replay: 'verify-first' }
    })
    const replay = await runtime.execute({
      identity,
      state: first.state,
      call: {
        callId: 'c1',
        toolName: 'bash',
        providerId: 'remote',
        toolKind: 'command_execution',
        arguments: { command: 'echo changed' }
      },
      context,
      policy: { effect: 'idempotent-write', replay: 'verify-first' }
    })
    expect(counter.value).toBe(1)
    expect(replay.result).toEqual(first.result)
    expect(replay.observation).toEqual({ ...first.observation, replayed: true })
  })

  it('suspends after a crash between non-idempotent execution and commit', async () => {
    const counter = { value: 0 }
    const runtime = new ToolRuntimeV3({ toolHost: host(counter), effects: new EffectCommitCoordinator({ events: new InMemoryRunEventStore(), results: new InMemoryEffectResultStore() }) })
    const result = await runtime.execute({ identity, state, call: { callId: 'c2', toolName: 'delete', arguments: {} }, context, policy: { effect: 'non-idempotent-write', replay: 'never' }, crashAfterExecute: true })
    expect(counter.value).toBe(1)
    expect(result.outcome).toMatchObject({ status: 'suspended' })
    expect(result.state.pendingEffects).toHaveLength(1)
    expect(result.observation).toBeUndefined()
  })

  it('does not fabricate an observation for a suspended pending effect', async () => {
    const counter = { value: 0 }
    const runtime = new ToolRuntimeV3({ toolHost: host(counter), effects: new EffectCommitCoordinator({ events: new InMemoryRunEventStore(), results: new InMemoryEffectResultStore() }) })
    const crashed = await runtime.execute({ identity, state, call: { callId: 'c2', toolName: 'delete', arguments: {} }, context, policy: { effect: 'non-idempotent-write', replay: 'never' }, crashAfterExecute: true })
    const suspended = await runtime.execute({ identity, state: crashed.state, call: { callId: 'c2', toolName: 'delete', arguments: {} }, context, policy: { effect: 'non-idempotent-write', replay: 'never' } })
    expect(suspended.outcome).toMatchObject({ status: 'suspended' })
    expect(suspended.result).toBeUndefined()
    expect(suspended.observation).toBeUndefined()
  })

  it('does not fabricate an observation for a non-result host item', async () => {
    const counter = { value: 0 }
    const approvalResult: ToolHostResult = {
      approved: false,
      item: {
        id: 'item-approval',
        turnId: 'tu1',
        threadId: 't1',
        role: 'tool',
        status: 'pending',
        createdAt: '2026-07-15T00:00:00.000Z',
        kind: 'approval',
        approvalId: 'approval-1',
        toolName: 'write',
        summary: 'Approve write'
      }
    }
    const runtime = new ToolRuntimeV3({
      toolHost: host(counter, approvalResult),
      effects: new EffectCommitCoordinator({ events: new InMemoryRunEventStore(), results: new InMemoryEffectResultStore() })
    })
    const result = await runtime.execute({
      identity,
      state,
      call: { callId: 'c3', toolName: 'write', arguments: { path: 'report.txt' } },
      context,
      policy: { effect: 'idempotent-write', replay: 'verify-first' }
    })
    expect(result.result?.item.kind).toBe('approval')
    expect(result.observation).toBeUndefined()
  })

  it('rejects invalid arguments before effect preparation or host execution', async () => {
    const counter = { value: 0 }
    const events = new InMemoryRunEventStore()
    const runtime = new ToolRuntimeV3({
      toolHost: host(counter),
      effects: new EffectCommitCoordinator({ events, results: new InMemoryEffectResultStore() })
    })
    await expect(runtime.execute({
      identity,
      state,
      call: { callId: 'invalid', toolName: 'write', arguments: { value: undefined } },
      context,
      policy: { effect: 'idempotent-write', replay: 'verify-first' }
    })).rejects.toThrow(/JSON/i)
    expect(counter.value).toBe(0)
    await expect(events.listAfter(identity, 0)).resolves.toEqual([])
  })

  it('rejects invalid effect policy before host preparation, execution, or effect events', async () => {
    let preparations = 0
    let executions = 0
    const events = new InMemoryRunEventStore()
    const invalidPolicyHost: ToolHost = {
      id: 'invalid-policy',
      async listTools() { return [] },
      async prepare(call) {
        preparations += 1
        return { call }
      },
      async execute() {
        executions += 1
        return toolResult()
      }
    }
    const runtime = new ToolRuntimeV3({
      toolHost: invalidPolicyHost,
      effects: new EffectCommitCoordinator({ events, results: new InMemoryEffectResultStore() })
    })

    await expect(runtime.execute({
      identity,
      state,
      call: { callId: 'invalid-policy', toolName: 'write', arguments: {} },
      context,
      policy: { effect: 'read', replay: 'safe', extra: true } as never
    })).rejects.toThrow()

    expect(preparations).toBe(0)
    expect(executions).toBe(0)
    expect(state.pendingEffects).toEqual([])
    expect(state.committedEffects).toEqual([])
    await expect(events.listAfter(identity, 0)).resolves.toEqual([])
  })

  it('commits an error-safe result when cyclic output cannot be serialized', async () => {
    const counter = { value: 0 }
    const cyclic: Record<string, unknown> = { ok: true }
    cyclic.self = cyclic
    const cyclicResult = toolResult()
    if (cyclicResult.item.kind !== 'tool_result') throw new Error('expected tool result')
    cyclicResult.item.output = cyclic
    const runtime = new ToolRuntimeV3({
      toolHost: host(counter, cyclicResult),
      effects: new EffectCommitCoordinator({ events: new InMemoryRunEventStore(), results: new InMemoryEffectResultStore() })
    })
    const input = {
      identity,
      state,
      call: { callId: 'c1', toolName: 'write', arguments: {} },
      context,
      policy: { effect: 'idempotent-write' as const, replay: 'verify-first' as const }
    }
    const first = await runtime.execute(input)
    const replay = await runtime.execute({ ...input, state: first.state })
    expect(counter.value).toBe(1)
    expect(first.state.committedEffects).toHaveLength(1)
    expect(first.result?.item).toMatchObject({
      kind: 'tool_result',
      status: 'failed',
      isError: true,
      output: {
        code: 'tool_result_not_strict_json',
        error: 'tool result was not strict JSON',
        type: 'circular-reference'
      }
    })
    expect(first.result?.semantic).toBeUndefined()
    expect(first.observation).toMatchObject({ failed: true, resourceKeys: [], artifactRefs: [] })
    expect(replay.result).toEqual(first.result)
  })

  it('uses one hook-rewritten effective call for preparation, execution, and observation', async () => {
    let hookCalls = 0
    let executedPath: unknown
    const events = new InMemoryRunEventStore()
    const localHost = new LocalToolHost({
      hooks: [{
        phase: 'PreToolUse',
        run: () => {
          hookCalls += 1
          return { arguments: { path: 'B.txt' } }
        }
      }],
      tools: [LocalToolHost.defineTool({
        name: 'write',
        description: 'Writes a test path.',
        inputSchema: { type: 'object' },
        policy: 'auto',
        capabilityClass: 'file.write',
        semantic: (args) => ({ capabilityClass: 'file.write', resourceKeys: [String(args.path)] }),
        execute: async (args) => {
          executedPath = args.path
          return { output: { path: args.path } }
        }
      })]
    })
    const runtime = new ToolRuntimeV3({
      toolHost: localHost,
      effects: new EffectCommitCoordinator({ events, results: new InMemoryEffectResultStore() })
    })
    const result = await runtime.execute({
      identity,
      state,
      call: { callId: 'rewrite', toolName: 'write', arguments: { path: 'A.txt' } },
      context,
      policy: { effect: 'idempotent-write', replay: 'verify-first' }
    })
    const preparedEvent = (await events.listAfter(identity, 0)).find((event) => event.eventType === 'effect.prepared')
    expect(hookCalls).toBe(1)
    expect(executedPath).toBe('B.txt')
    expect(preparedEvent?.payload).toMatchObject({ payloadDigest: digestValue({ path: 'B.txt' }) })
    expect(result.observation?.canonicalArgumentsDigest).toBe(canonicalToolDigest({
      callId: 'rewrite',
      toolName: 'write',
      arguments: { path: 'B.txt' }
    }))
    expect(result.observation?.resourceKeys).toEqual(['B.txt'])
  })

  it('single-flights concurrent execution of the same logical effect', async () => {
    const counter = { value: 0 }
    const delayedHost: ToolHost = {
      id: 'delayed',
      async listTools() { return [] },
      async execute() {
        counter.value += 1
        await new Promise<void>((resolve) => setImmediate(resolve))
        return toolResult()
      }
    }
    const runtime = new ToolRuntimeV3({
      toolHost: delayedHost,
      effects: new EffectCommitCoordinator({ events: new InMemoryRunEventStore(), results: new InMemoryEffectResultStore() })
    })
    const input = {
      identity,
      state,
      call: { callId: 'c1', toolName: 'write', arguments: {} },
      context,
      policy: { effect: 'idempotent-write' as const, replay: 'verify-first' as const }
    }
    const [first, second] = await Promise.all([runtime.execute(input), runtime.execute(input)])
    expect(counter.value).toBe(1)
    expect(second).toEqual(first)
    expect(first.state.committedEffects).toHaveLength(1)
  })

  it('cleans the single-flight reservation after execution rejects', async () => {
    let attempts = 0
    const retryHost: ToolHost = {
      id: 'retry',
      async listTools() { return [] },
      async execute() {
        attempts += 1
        if (attempts === 1) throw new Error('first attempt failed')
        return toolResult()
      }
    }
    const runtime = new ToolRuntimeV3({
      toolHost: retryHost,
      effects: new EffectCommitCoordinator({ events: new InMemoryRunEventStore(), results: new InMemoryEffectResultStore() })
    })
    const input = {
      identity,
      state,
      call: { callId: 'c1', toolName: 'write', arguments: {} },
      context,
      policy: { effect: 'idempotent-write' as const, replay: 'safe' as const }
    }
    await expect(runtime.execute(input)).rejects.toThrow('first attempt failed')
    const second = await runtime.execute(input)
    expect(attempts).toBe(2)
    expect(second.state.committedEffects).toHaveLength(1)
  })

  it('rejects an invalid hook rewrite before preparing or executing the effect', async () => {
    let executions = 0
    const events = new InMemoryRunEventStore()
    const localHost = new LocalToolHost({
      hooks: [{ phase: 'PreToolUse', run: () => ({ arguments: { path: undefined } }) }],
      tools: [LocalToolHost.defineTool({
        name: 'write',
        description: 'Writes a test path.',
        inputSchema: { type: 'object' },
        policy: 'auto',
        execute: async () => {
          executions += 1
          return { output: { ok: true } }
        }
      })]
    })
    const runtime = new ToolRuntimeV3({
      toolHost: localHost,
      effects: new EffectCommitCoordinator({ events, results: new InMemoryEffectResultStore() })
    })
    await expect(runtime.execute({
      identity,
      state,
      call: { callId: 'invalid-rewrite', toolName: 'write', arguments: { path: 'A.txt' } },
      context,
      policy: { effect: 'idempotent-write', replay: 'safe' }
    })).rejects.toThrow(/JSON/i)
    expect(executions).toBe(0)
    await expect(events.listAfter(identity, 0)).resolves.toEqual([])
  })
})
