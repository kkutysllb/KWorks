import { expect, it } from 'vitest'
import { InMemoryEffectResultStore, InMemoryRunEventStore } from '@qiongqi/adapter-storage'
import { EffectCommitCoordinator, InflightTracker, ToolCallCoordinator, ToolRuntimeV3 } from '@qiongqi/loop'
import type { RunStateV3 } from '@qiongqi/contracts'
import type { ToolCallLike, ToolHost, ToolHostContext } from '@qiongqi/ports'

it('routes coordinator tool execution through ToolRuntimeV3 when configured', async () => {
  const events = new InMemoryRunEventStore()
  let executions = 0
  const host: ToolHost = { id: 'host', async listTools() { return [] }, async execute() { executions += 1; return { item: {} as never, approved: true } } }
  const runtime = new ToolRuntimeV3({ toolHost: host, effects: new EffectCommitCoordinator({ events, results: new InMemoryEffectResultStore() }) })
  const identity = { ownerUserId: 'u', workspaceKey: 'w', threadId: 't', turnId: 'tu', runId: 'r' }
  const state: RunStateV3 = { version: 3, graphVersion: 'g', runtimeMode: 'kernel_v3', ...identity, status: 'running', cursor: { stepIndex: 0, nodeId: 'tool', attempt: 0, checkpointSeq: 0 }, budgets: { stepsUsed: 0, toolCallsUsed: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 }, recovery: { attempts: 0, maxAttempts: 1 }, middleware: {}, pendingEffects: [], committedEffects: [], createdAt: 'now', updatedAt: 'now' }
  let latestState = state
  const coordinator = new ToolCallCoordinator({ toolHost: host, toolRuntime: runtime, approvalGate: {} as never, userInputGate: {} as never, inflight: new InflightTracker(), events: {} as never, turns: {} as never, ids: {} as never, nowIso: () => 'now', memoryStoreEnabled: false })
  const context = { threadId: 't', turnId: 'tu', workspace: 'w', approvalPolicy: 'trusted', abortSignal: new AbortController().signal, awaitApproval: async () => 'allow', runtimeIdentity: identity, runtimeState: state, runtimeStateSink: (next: RunStateV3) => { latestState = next } } as ToolHostContext
  const call: ToolCallLike = { callId: 'c1', toolName: 'read', arguments: {} }
  await coordinator.executeToolCall({ threadId: 't', turnId: 'tu', call, context })
  expect(executions).toBe(1)
  expect(latestState.committedEffects).toHaveLength(1)
  expect(await events.listAfter(identity, 0)).toHaveLength(2)
})

it('merges committed effects from parallel distinct calls and replays both', async () => {
  const events = new InMemoryRunEventStore()
  const results = new InMemoryEffectResultStore()
  let executions = 0
  const host: ToolHost = {
    id: 'parallel-host',
    async listTools() { return [] },
    async execute(call) {
      executions += 1
      await new Promise<void>((resolve) => setImmediate(resolve))
      return {
        approved: true,
        item: {
          id: `item-${call.callId}`,
          threadId: 't',
          turnId: 'tu',
          role: 'tool',
          status: 'completed',
          createdAt: 'now',
          finishedAt: 'now',
          kind: 'tool_result',
          toolName: call.toolName,
          callId: call.callId,
          toolKind: 'tool_call',
          output: { callId: call.callId },
          isError: false
        }
      }
    }
  }
  const runtime = new ToolRuntimeV3({
    toolHost: host,
    effects: new EffectCommitCoordinator({ events, results })
  })
  const identity = { ownerUserId: 'u', workspaceKey: 'w', threadId: 't', turnId: 'tu', runId: 'parallel' }
  const state: RunStateV3 = { version: 3, graphVersion: 'g', runtimeMode: 'kernel_v3', ...identity, status: 'running', cursor: { stepIndex: 0, nodeId: 'tool', attempt: 0, checkpointSeq: 0 }, budgets: { stepsUsed: 0, toolCallsUsed: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 }, recovery: { attempts: 0, maxAttempts: 1 }, middleware: {}, pendingEffects: [], committedEffects: [], createdAt: 'now', updatedAt: 'now' }
  let latestState = state
  const context = {
    threadId: 't',
    turnId: 'tu',
    workspace: 'w',
    approvalPolicy: 'trusted',
    abortSignal: new AbortController().signal,
    awaitApproval: async () => 'allow',
    runtimeIdentity: identity,
    runtimeState: state,
    runtimeStateSink: (next: RunStateV3) => { latestState = next }
  } as ToolHostContext
  const coordinator = new ToolCallCoordinator({
    toolHost: host,
    toolRuntime: runtime,
    approvalGate: {} as never,
    userInputGate: {} as never,
    inflight: new InflightTracker(),
    events: {} as never,
    turns: {} as never,
    ids: {} as never,
    nowIso: () => 'now',
    memoryStoreEnabled: false
  })
  const calls: ToolCallLike[] = [
    { callId: 'c1', toolName: 'read', arguments: {} },
    { callId: 'c2', toolName: 'read', arguments: {} }
  ]

  await Promise.all(calls.map((call) => coordinator.executeToolCall({ threadId: 't', turnId: 'tu', call, context })))

  expect(executions).toBe(2)
  expect(latestState.committedEffects.map((effect) => effect.idempotencyKey)).toEqual(expect.arrayContaining([
    'u:w:parallel:c1',
    'u:w:parallel:c2'
  ]))
  expect((await events.listAfter(identity, 0)).map((event) => event.seq)).toEqual([1, 2, 3, 4])

  await Promise.all(calls.map((call) => runtime.execute({
    identity,
    state: latestState,
    call,
    context,
    policy: { effect: 'read', replay: 'safe' }
  })))
  expect(executions).toBe(2)
})
