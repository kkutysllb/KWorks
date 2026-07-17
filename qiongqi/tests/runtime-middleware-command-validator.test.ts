import { describe, expect, it } from 'vitest'
import { InMemoryRunEventStore, InMemoryRunStateStore } from '@qiongqi/adapter-storage'
import type { RunIdentity, RunStateV3 } from '@qiongqi/contracts'
import {
  MiddlewareChain,
  RuntimeKernel,
  canonicalizeMiddlewareCommands,
  type ExecutionGraph,
  type MiddlewareCommand
} from '@qiongqi/loop'

const identity: RunIdentity = {
  ownerUserId: 'owner-validator',
  workspaceKey: 'workspace-validator',
  threadId: 'thread-validator',
  turnId: 'turn-validator',
  runId: 'run-validator'
}

const graph: ExecutionGraph = {
  version: 'command-validator-v1',
  startNodeId: 'work',
  predicates: ['next'],
  nodes: [
    { id: 'work', kind: 'work', effect: 'state', checkpoint: 'both' },
    { id: 'complete', kind: 'complete', effect: 'state', terminal: true, checkpoint: 'both' }
  ],
  edges: [{ from: 'work', to: 'complete', when: 'next' }]
}

function state(): RunStateV3 {
  return {
    version: 3,
    graphVersion: graph.version,
    runtimeMode: 'kernel_v3',
    ...identity,
    status: 'running',
    cursor: { stepIndex: 0, nodeId: 'work', attempt: 0, checkpointSeq: 1 },
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

const complete = () => ({
  outcome: { status: 'completed', reason: 'normal_stop', retryable: false } as const
})

describe('canonicalizeMiddlewareCommands', () => {
  it.each([
    {
      label: 'negative set-budget',
      command: { type: 'set-budget', key: 'stepsUsed', value: -1 }
    },
    {
      label: 'unsafe set-budget',
      command: {
        type: 'set-budget',
        key: 'inputTokens',
        value: Number.MAX_SAFE_INTEGER + 1
      }
    },
    {
      label: 'invalid middleware version',
      command: {
        type: 'set-middleware-state',
        id: 'test',
        state: { version: 0, data: {} }
      }
    },
    {
      label: 'malformed terminate outcome',
      command: {
        type: 'terminate',
        outcome: { status: 'suspended', reason: 'awaiting_user_input', retryable: true }
      }
    },
    {
      label: 'unknown command',
      command: { type: 'delete-budget', key: 'stepsUsed' }
    },
    {
      label: 'invalid add-budget',
      command: { type: 'add-budget', delta: { unknown: 1 } }
    },
    {
      label: 'missing node data',
      command: { type: 'set-node-data', nodeId: 'node' }
    },
    {
      label: 'invalid task revision',
      command: { type: 'set-task-revision', revision: -1 }
    },
    {
      label: 'invalid recovery state',
      command: { type: 'set-recovery', recovery: { attempts: -1, maxAttempts: 1 } }
    },
    {
      label: 'invalid effects',
      command: { type: 'set-effects', pendingEffects: [{}], committedEffects: [] }
    },
    {
      label: 'invalid jump',
      command: { type: 'jump', nodeId: 'node', condition: 'next', reason: '' }
    },
    {
      label: 'malformed suspend outcome',
      command: {
        type: 'suspend',
        outcome: { status: 'completed', reason: 'normal_stop', retryable: false }
      }
    },
    {
      label: 'invalid retry',
      command: { type: 'retry', reason: '' }
    },
    {
      label: 'invalid history repair',
      command: { type: 'repair-history', items: {} }
    },
    {
      label: 'invalid warning',
      command: { type: 'record-warning', code: '', message: 'message' }
    }
  ])('rejects $label', ({ command }) => {
    expect(() => canonicalizeMiddlewareCommands([command])).toThrow(
      expect.objectContaining({ message: expect.stringContaining(String(command.type)) })
    )
  })

  it('rejects a non-array command collection', () => {
    expect(() => canonicalizeMiddlewareCommands({})).toThrow('expected an array')
  })

  it('accepts every middleware command variant', () => {
    expect(canonicalizeMiddlewareCommands([
      {
        type: 'set-middleware-state',
        id: 'middleware',
        state: { version: 1, data: { kept: true, omitted: undefined } }
      },
      { type: 'set-budget', key: 'stepsUsed', value: 1 },
      { type: 'add-budget', delta: { inputTokens: 2, costUsd: 0.25 }, usageId: 'usage-1' },
      { type: 'set-node-data', nodeId: 'node', value: { value: true } },
      { type: 'set-task-revision', revision: 2 },
      { type: 'set-recovery', recovery: { attempts: 1, maxAttempts: 2 } },
      {
        type: 'set-effects',
        pendingEffects: [{
          idempotencyKey: 'effect-1',
          kind: 'tool',
          effect: 'read',
          replay: 'safe',
          target: 'tool:test',
          payloadDigest: 'sha256:payload',
          preparedAt: 'now'
        }],
        committedEffects: [{
          idempotencyKey: 'effect-1',
          resultDigest: 'sha256:result',
          status: 'committed',
          committedAt: 'now'
        }]
      },
      { type: 'jump', nodeId: 'next', condition: 'next', reason: 'redirect' },
      {
        type: 'terminate',
        outcome: { status: 'completed', reason: 'normal_stop', retryable: false }
      },
      {
        type: 'suspend',
        outcome: { status: 'suspended', reason: 'awaiting_user_input', retryable: true }
      },
      { type: 'retry', reason: 'try again' },
      { type: 'repair-history', items: [{ kept: true, omitted: undefined }] },
      { type: 'record-warning', code: 'warning', message: 'message' }
    ])).toEqual([
      {
        type: 'set-middleware-state',
        id: 'middleware',
        state: { version: 1, data: { kept: true } }
      },
      { type: 'set-budget', key: 'stepsUsed', value: 1 },
      { type: 'add-budget', delta: { inputTokens: 2, costUsd: 0.25 }, usageId: 'usage-1' },
      { type: 'set-node-data', nodeId: 'node', value: { value: true } },
      { type: 'set-task-revision', revision: 2 },
      { type: 'set-recovery', recovery: { attempts: 1, maxAttempts: 2 } },
      {
        type: 'set-effects',
        pendingEffects: [{
          idempotencyKey: 'effect-1',
          kind: 'tool',
          effect: 'read',
          replay: 'safe',
          target: 'tool:test',
          payloadDigest: 'sha256:payload',
          preparedAt: 'now'
        }],
        committedEffects: [{
          idempotencyKey: 'effect-1',
          resultDigest: 'sha256:result',
          status: 'committed',
          committedAt: 'now'
        }]
      },
      { type: 'jump', nodeId: 'next', condition: 'next', reason: 'redirect' },
      {
        type: 'terminate',
        outcome: { status: 'completed', reason: 'normal_stop', retryable: false }
      },
      {
        type: 'suspend',
        outcome: { status: 'suspended', reason: 'awaiting_user_input', retryable: true }
      },
      { type: 'retry', reason: 'try again' },
      { type: 'repair-history', items: [{ kept: true }] },
      { type: 'record-warning', code: 'warning', message: 'message' }
    ])
  })

  it('canonicalizes JSON-backed command data', () => {
    expect(canonicalizeMiddlewareCommands([{
      type: 'set-node-data',
      nodeId: 'node',
      value: {
        kept: true,
        omitted: undefined,
        list: ['kept', undefined]
      }
    }])).toEqual([{
      type: 'set-node-data',
      nodeId: 'node',
      value: { kept: true, list: ['kept', null] }
    }])
  })
})

describe('RuntimeKernel persisted command validation', () => {
  it('rejects invalid handler commands before node.completed persistence', async () => {
    const snapshots = new InMemoryRunStateStore()
    const events = new InMemoryRunEventStore()
    const kernel = new RuntimeKernel({
      graph,
      snapshots,
      events,
      leases: snapshots,
      holderId: 'validator-local',
      nodes: {
        work: () => ({
          condition: 'next',
          commands: [{ type: 'set-budget', key: 'stepsUsed', value: -1 } as MiddlewareCommand]
        }),
        complete
      }
    })

    await expect(kernel.run(identity)).resolves.toMatchObject({
      status: 'failed',
      reason: 'runtime_error'
    })
    expect((await events.listAfter(identity, 0)).filter(
      (event) => event.eventType === 'node.completed'
    )).toEqual([])
    expect((await snapshots.load(identity))?.budgets.stepsUsed).toBe(0)
  })

  it('rejects invalid afterNode commands before after-middleware persistence', async () => {
    const snapshots = new InMemoryRunStateStore()
    const events = new InMemoryRunEventStore()
    const kernel = new RuntimeKernel({
      graph,
      snapshots,
      events,
      leases: snapshots,
      holderId: 'validator-after',
      middleware: new MiddlewareChain([{
        id: 'invalid-after',
        version: 1,
        hooks: ['afterNode'],
        handle: async (context, next) => context.node?.id === 'work'
          ? {
              commands: [{
                type: 'set-middleware-state',
                id: 'invalid',
                state: { version: 0, data: {} }
              }]
            }
          : next(context)
      }]),
      nodes: { work: () => ({ condition: 'next' }), complete }
    })

    await expect(kernel.run(identity)).resolves.toMatchObject({ status: 'failed' })
    expect((await events.listAfter(identity, 0)).filter(
      (event) => event.eventType === 'node.after_middleware' && event.stepId === 'work'
    )).toEqual([])
    expect((await snapshots.load(identity))?.middleware).toEqual({})
  })

  it('rejects malformed commands in a replayed node.completed event', async () => {
    const snapshots = new InMemoryRunStateStore()
    const events = new InMemoryRunEventStore()
    await snapshots.save(state())
    await events.append({
      eventId: 'completed-invalid-command',
      seq: 2,
      ...identity,
      stepId: 'work',
      nodeAttemptId: 'work:0',
      eventType: 'node.completed',
      payload: {
        nodeId: 'work',
        stepIndex: 0,
        condition: 'next',
        commands: [{ type: 'set-budget', key: 'stepsUsed', value: -1 }]
      },
      timestamp: 'now'
    })
    const errors: string[] = []
    const kernel = new RuntimeKernel({
      graph,
      snapshots,
      events,
      leases: snapshots,
      holderId: 'validator-replay',
      middleware: new MiddlewareChain([{
        id: 'error-observer',
        version: 1,
        hooks: ['onError'],
        handle: async (context, next) => {
          errors.push(context.error instanceof Error ? context.error.message : String(context.error))
          return next(context)
        }
      }]),
      nodes: { work: () => { throw new Error('must replay') }, complete }
    })

    await expect(kernel.run(identity)).resolves.toMatchObject({ status: 'failed' })
    expect(errors).toEqual([expect.stringContaining('set-budget')])
    expect((await snapshots.load(identity))?.budgets.stepsUsed).toBe(0)
  })

  it('rejects unknown commands in a replayed after-middleware event', async () => {
    const snapshots = new InMemoryRunStateStore()
    const events = new InMemoryRunEventStore()
    await snapshots.save(state())
    await events.append({
      eventId: 'completed-before-invalid-after',
      seq: 2,
      ...identity,
      stepId: 'work',
      nodeAttemptId: 'work:0',
      eventType: 'node.completed',
      payload: {
        nodeId: 'work',
        stepIndex: 0,
        condition: 'next',
        commands: []
      },
      timestamp: 'now'
    })
    await events.append({
      eventId: 'invalid-after-command',
      seq: 3,
      ...identity,
      stepId: 'work',
      nodeAttemptId: 'work:0',
      eventType: 'node.after_middleware',
      payload: {
        nodeId: 'work',
        stepIndex: 0,
        commands: [{ type: 'unknown-command' }]
      },
      timestamp: 'now'
    })
    const kernel = new RuntimeKernel({
      graph,
      snapshots,
      events,
      leases: snapshots,
      holderId: 'validator-after-replay',
      nodes: { work: () => { throw new Error('must replay') }, complete }
    })

    await expect(kernel.run(identity)).resolves.toMatchObject({ status: 'failed' })
    expect((await snapshots.load(identity))?.middleware).toEqual({})
  })
})
