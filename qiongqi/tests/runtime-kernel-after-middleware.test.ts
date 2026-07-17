import { describe, expect, it } from 'vitest'
import { InMemoryRunEventStore, InMemoryRunStateStore } from '@qiongqi/adapter-storage'
import type { RunIdentity } from '@qiongqi/contracts'
import {
  MiddlewareChain,
  RuntimeKernel,
  type ExecutionGraph,
  type RuntimeMiddleware
} from '@qiongqi/loop'

const identity: RunIdentity = {
  ownerUserId: 'owner-after',
  workspaceKey: 'workspace-after',
  threadId: 'thread-after',
  turnId: 'turn-after',
  runId: 'run-after'
}

const graph: ExecutionGraph = {
  version: 'after-middleware-v1',
  startNodeId: 'work',
  predicates: ['next'],
  nodes: [
    { id: 'work', kind: 'work', effect: 'state', checkpoint: 'both' },
    { id: 'complete', kind: 'complete', effect: 'state', terminal: true, checkpoint: 'both' }
  ],
  edges: [{ from: 'work', to: 'complete', when: 'next' }]
}

function middleware(calls: string[], terminate = false, afterRuns: string[] = []): MiddlewareChain {
  const item: RuntimeMiddleware = {
    id: 'facts-governance',
    version: 1,
    hooks: ['afterNode', 'afterRun'],
    handle: async (context, next) => {
      if (context.hook === 'afterRun') {
        afterRuns.push('afterRun')
        return next(context)
      }
      if (context.node?.id !== 'work') return next(context)
      calls.push(String(context.facts?.decision))
      return {
        commands: terminate
          ? [{
              type: 'terminate',
              outcome: {
                status: 'degraded',
                reason: 'step_capped',
                retryable: false,
                details: { code: 'facts_terminate' }
              }
            }]
          : [{
              type: 'set-middleware-state',
              id: 'facts-governance',
              state: { version: 1, data: { decision: context.facts?.decision } }
            }]
      }
    }
  }
  return new MiddlewareChain([item])
}

function nodes() {
  return {
    work: () => ({ condition: 'next', facts: { decision: 'apply' } }),
    complete: () => ({
      outcome: { status: 'completed', reason: 'normal_stop', retryable: false } as const
    })
  }
}

function kernel(input: {
  snapshots: InMemoryRunStateStore
  events: InMemoryRunEventStore
  calls: string[]
  crashAt?: string
  terminate?: boolean
  afterRuns?: string[]
}) {
  let crashed = false
  return new RuntimeKernel({
    graph,
    snapshots: input.snapshots,
    events: input.events,
    leases: input.snapshots,
    holderId: `after-${input.crashAt ?? 'resume'}`,
    middleware: middleware(input.calls, input.terminate, input.afterRuns),
    nodes: nodes(),
    ...(input.crashAt
      ? {
          crashPoint: (point: string) => {
            if (!crashed && point === input.crashAt) {
              crashed = true
              throw new Error(`crash:${point}`)
            }
          }
        }
      : {})
  } as never)
}

async function afterEvents(events: InMemoryRunEventStore) {
  return (await events.listAfter(identity, 0)).filter(
    (event) => event.eventType === 'node.after_middleware' && event.stepId === 'work'
  )
}

describe('RuntimeKernel durable afterNode middleware', () => {
  it('reruns afterNode after a crash immediately following node.completed', async () => {
    const snapshots = new InMemoryRunStateStore()
    const events = new InMemoryRunEventStore()
    const calls: string[] = []

    await expect(kernel({
      snapshots,
      events,
      calls,
      crashAt: 'after_node_completed'
    }).run(identity)).rejects.toThrow('crash:after_node_completed')

    await expect(kernel({ snapshots, events, calls }).run(identity)).resolves.toMatchObject({
      status: 'completed'
    })
    expect(calls).toEqual(['apply'])
    await expect(snapshots.load(identity)).resolves.toMatchObject({
      middleware: {
        'facts-governance': { version: 1, data: { decision: 'apply' } }
      }
    })
    expect(await afterEvents(events)).toHaveLength(1)
  })

  it('persists one command application when crashing after middleware returns', async () => {
    const snapshots = new InMemoryRunStateStore()
    const events = new InMemoryRunEventStore()
    const calls: string[] = []

    await expect(kernel({
      snapshots,
      events,
      calls,
      crashAt: 'after_node_middleware'
    }).run(identity)).rejects.toThrow('crash:after_node_middleware')

    await kernel({ snapshots, events, calls }).run(identity)

    expect(calls).toEqual(['apply', 'apply'])
    await expect(snapshots.load(identity)).resolves.toMatchObject({
      middleware: {
        'facts-governance': { version: 1, data: { decision: 'apply' } }
      }
    })
    expect(await afterEvents(events)).toHaveLength(1)
  })

  it('replays recorded termination without rerunning middleware after event persistence', async () => {
    const snapshots = new InMemoryRunStateStore()
    const events = new InMemoryRunEventStore()
    const calls: string[] = []
    const afterRuns: string[] = []

    await expect(kernel({
      snapshots,
      events,
      calls,
      afterRuns,
      terminate: true,
      crashAt: 'after_node_after_middleware_event'
    }).run(identity)).rejects.toThrow('crash:after_node_after_middleware_event')

    await expect(kernel({ snapshots, events, calls, afterRuns, terminate: true }).run(identity)).resolves.toMatchObject({
      status: 'degraded',
      reason: 'step_capped',
      details: { code: 'facts_terminate' }
    })
    expect(calls).toEqual(['apply'])
    expect(afterRuns).toEqual(['afterRun'])
    expect(await afterEvents(events)).toHaveLength(1)
  })

  it('checkpoints a repaired legacy terminal completion exactly once', async () => {
    const snapshots = new InMemoryRunStateStore()
    const events = new InMemoryRunEventStore()
    const calls: string[] = []
    const afterRuns: string[] = []
    await snapshots.save({
      version: 3,
      graphVersion: graph.version,
      runtimeMode: 'kernel_v3',
      ...identity,
      status: 'completed',
      cursor: { stepIndex: 0, nodeId: 'work', attempt: 0, checkpointSeq: 2 },
      budgets: { stepsUsed: 0, toolCallsUsed: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
      recovery: { attempts: 0, maxAttempts: 1 },
      middleware: {},
      nodeData: {},
      taskRevision: 0,
      pendingEffects: [],
      committedEffects: [],
      outcome: { status: 'completed', reason: 'normal_stop', retryable: false },
      createdAt: 'now',
      updatedAt: 'now'
    })
    await events.append({
      eventId: 'started-work',
      seq: 1,
      ...identity,
      stepId: 'work',
      nodeAttemptId: 'work:0',
      eventType: 'node.started',
      payload: { nodeId: 'work', stepIndex: 0 },
      timestamp: 'now'
    })
    await events.append({
      eventId: 'completed-work',
      seq: 2,
      ...identity,
      stepId: 'work',
      nodeAttemptId: 'work:0',
      eventType: 'node.completed',
      payload: {
        nodeId: 'work',
        stepIndex: 0,
        condition: 'next',
        commands: [],
        facts: { decision: 'apply' },
        outcome: { status: 'completed', reason: 'normal_stop', retryable: false }
      },
      timestamp: 'now'
    })

    await kernel({ snapshots, events, calls, afterRuns }).run(identity)
    await kernel({ snapshots, events, calls, afterRuns }).run(identity)

    expect(calls).toEqual(['apply'])
    expect(afterRuns).toEqual(['afterRun'])
    await expect(snapshots.load(identity)).resolves.toMatchObject({
      cursor: { checkpointSeq: 3 }
    })
  })
})
