import { describe, expect, it } from 'vitest'
import { EffectCommitCoordinator, ToolRuntimeV3 } from '@qiongqi/loop'
import { InMemoryEffectResultStore, InMemoryRunEventStore } from '@qiongqi/adapter-storage'
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
      resourceKeys: ['/tmp/report.txt'],
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
})
