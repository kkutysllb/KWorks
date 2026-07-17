import { describe, expect, it } from 'vitest'
import {
  InMemoryEventBus,
  InMemoryRunEventStore,
  InMemoryRunStateStore,
  InMemorySessionStore,
  InMemoryThreadStore
} from '@qiongqi/adapter-storage'
import type {
  ModelProposal,
  RunIdentity,
  RunOutcome,
  RunStateV3,
  TaskStateV1,
  TurnItem
} from '@qiongqi/contracts'
import {
  createThreadRecord,
  createTurnRecord,
  makeToolCallItem,
  startTurn
} from '@qiongqi/domain'
import {
  ContextCompactor,
  InflightTracker,
  RuntimeKernel,
  SteeringQueue,
  createKernelV3NodeHandlers,
  productionKernelV3Graph
} from '@qiongqi/loop'
import { SequentialIdGenerator } from '@qiongqi/ports'
import { RuntimeEventRecorder, TurnService } from '@qiongqi/services'

const identity: RunIdentity = {
  ownerUserId: 'owner-migration',
  workspaceKey: '/workspace-migration',
  threadId: 'thread-migration',
  turnId: 'turn-migration',
  runId: 'run-migration'
}

describe('production kernel graph migration', () => {
  it('reports production graph version v3', () => {
    expect(productionKernelV3Graph().version).toBe('kernel-v3-production-v3')
  })

  it.each(['prepare-tools', 'commit-tools']) (
    'routes an old v1 %s snapshot through materialization before tool execution',
    async (nodeId) => {
      const snapshots = new InMemoryRunStateStore()
      const events = new InMemoryRunEventStore()
      const persisted = new Map<string, TurnItem>()
      if (nodeId === 'commit-tools') {
        const call = makeToolCallItem({
          id: `item_tool_${identity.turnId}_call-1`,
          threadId: identity.threadId,
          turnId: identity.turnId,
          callId: 'call-1',
          toolName: 'read_data',
          arguments: {},
          status: 'running'
        })
        persisted.set(call.id, call)
      }
      const applyOnce = async (_threadId: string, item: TurnItem) => {
        if (!persisted.has(item.id)) persisted.set(item.id, item)
      }
      const baseHandlers = createKernelV3NodeHandlers({
        turns: { applyItem: applyOnce, applyItemOnce: applyOnce }
      } as never)
      let executions = 0
      const nodes = {
        ...baseHandlers,
        'commit-tools': () => {
          executions += 1
          expect(persisted.has('item_kernel_reasoning_proposal-migration')).toBe(true)
          expect(persisted.has('item_kernel_text_proposal-migration')).toBe(true)
          return { outcome: { status: 'completed', reason: 'normal_stop', retryable: false } } as const
        }
      }
      await snapshots.save(oldState(nodeId))
      const kernel = new RuntimeKernel({
        graph: productionKernelV3Graph(),
        snapshots,
        events,
        leases: snapshots,
        holderId: 'migration-test',
        nodes
      })

      await expect(kernel.run(identity)).resolves.toMatchObject({ status: 'completed' })
      expect(executions).toBe(1)
      expect([...persisted.keys()].filter((id) => id.includes('item_tool_'))).toHaveLength(1)
      expect((await events.listAfter(identity, 0))
        .filter((event) => event.eventType === 'node.started')
        .map((event) => event.stepId)).toEqual([
        'account-model',
        'evaluate',
        'materialize-proposal',
        'prepare-tools',
        'commit-tools'
      ])
      await expect(snapshots.load(identity)).resolves.toMatchObject({
        graphVersion: 'kernel-v3-production-v3'
      })
    }
  )

  it('fails unsupported graph versions with structured details', async () => {
    const snapshots = new InMemoryRunStateStore()
    const events = new InMemoryRunEventStore()
    await snapshots.save({ ...oldState('prepare-tools'), graphVersion: 'kernel-v3-production-v0' })
    const kernel = new RuntimeKernel({
      graph: productionKernelV3Graph(),
      snapshots,
      events,
      leases: snapshots,
      holderId: 'migration-test',
      nodes: {}
    })

    await expect(kernel.run(identity)).resolves.toMatchObject({
      status: 'failed',
      reason: 'runtime_error',
      details: { code: 'unsupported_graph_version' }
    })
  })

  it.each([
    { status: 'completed', reason: 'normal_stop' },
    { status: 'failed', reason: 'tool_failed' },
    { status: 'aborted', reason: 'user_aborted' }
  ] as const)('returns a stored $status outcome before graph compatibility checks', async ({
    status,
    reason
  }) => {
    const snapshots = new InMemoryRunStateStore()
    const events = new InMemoryRunEventStore()
    const outcome: RunOutcome = { status, reason, retryable: false }
    await snapshots.save({
      ...oldState('prepare-tools'),
      graphVersion: 'kernel-v3-production-v0',
      status,
      outcome
    })
    const kernel = new RuntimeKernel({
      graph: productionKernelV3Graph(),
      snapshots,
      events,
      leases: snapshots,
      holderId: 'migration-test',
      nodes: {}
    })

    await expect(kernel.run(identity)).resolves.toEqual(outcome)
  })

  it('re-evaluates and quarantines a v1 tool snapshot with context-loss reasoning', async () => {
    const snapshots = new InMemoryRunStateStore()
    const events = new InMemoryRunEventStore()
    const proposal = modelProposal({
      reasoning: 'What should I continue with?',
      text: ''
    })
    await snapshots.save(oldState('prepare-tools', proposal))
    const persisted = new Map<string, TurnItem>()
    const applyOnce = async (_threadId: string, item: TurnItem) => {
      if (!persisted.has(item.id)) persisted.set(item.id, item)
    }
    const baseHandlers = createKernelV3NodeHandlers({
      turns: { applyItem: applyOnce, applyItemOnce: applyOnce }
    } as never)
    let executions = 0
    const kernel = new RuntimeKernel({
      graph: productionKernelV3Graph(),
      snapshots,
      events,
      leases: snapshots,
      holderId: 'migration-test',
      nodes: {
        ...baseHandlers,
        'commit-tools': () => {
          executions += 1
          return { outcome: { status: 'completed', reason: 'normal_stop', retryable: false } }
        },
        'recover-context': () => ({
          outcome: { status: 'completed', reason: 'normal_stop', retryable: false }
        })
      }
    })

    await expect(kernel.run(identity)).resolves.toMatchObject({ status: 'completed' })
    expect(executions).toBe(0)
    expect([...persisted.keys()]).toEqual([])
    expect((await events.listAfter(identity, 0))
      .filter((event) => event.eventType === 'node.started')
      .map((event) => event.stepId)).toEqual(['account-model', 'evaluate', 'recover-context'])
  })

  it('re-evaluates a v1 commit-assistant snapshot before materializing reasoning', async () => {
    const snapshots = new InMemoryRunStateStore()
    const events = new InMemoryRunEventStore()
    const proposal = modelProposal({
      stopClass: 'normal',
      reasoning: 'What should I continue with?',
      text: '',
      toolIntents: []
    })
    await snapshots.save(oldState('commit-assistant', proposal))
    const persisted = new Map<string, TurnItem>()
    const applyOnce = async (_threadId: string, item: TurnItem) => {
      if (!persisted.has(item.id)) persisted.set(item.id, item)
    }
    const baseHandlers = createKernelV3NodeHandlers({
      turns: { applyItem: applyOnce, applyItemOnce: applyOnce }
    } as never)
    const kernel = new RuntimeKernel({
      graph: productionKernelV3Graph(),
      snapshots,
      events,
      leases: snapshots,
      holderId: 'migration-test',
      nodes: {
        ...baseHandlers,
        'recover-context': () => ({
          outcome: { status: 'completed', reason: 'normal_stop', retryable: false }
        })
      }
    })

    await expect(kernel.run(identity)).resolves.toMatchObject({ status: 'completed' })
    expect([...persisted.keys()]).toEqual([])
    expect((await events.listAfter(identity, 0))
      .filter((event) => event.eventType === 'node.started')
      .map((event) => event.stepId)).toEqual(['account-model', 'evaluate', 'recover-context'])
  })

  it('aborts a prepared v1 tool call when re-evaluation recovers context', async () => {
    const runtime = await createRealTurnRuntime()
    const preparedCall = makeToolCallItem({
      id: `item_tool_${identity.turnId}_call-1`,
      threadId: identity.threadId,
      turnId: identity.turnId,
      callId: 'call-1',
      toolName: 'read_data',
      arguments: {},
      status: 'running'
    })
    await runtime.turns.applyItemOnce(identity.threadId, preparedCall)
    const snapshots = new InMemoryRunStateStore()
    const runEvents = new InMemoryRunEventStore()
    const proposal = modelProposal({
      reasoning: 'What should I continue with?',
      text: ''
    })
    await snapshots.save(oldState('commit-tools', proposal))
    const handlers = createKernelV3NodeHandlers({
      turns: runtime.turns,
      nowIso: () => '2026-07-16T00:00:00.000Z'
    } as never)
    let executions = 0
    const final = modelProposal({
      proposalId: 'proposal-after-migration-recovery',
      stopClass: 'normal',
      reasoning: '',
      text: 'Recovered final response.',
      toolIntents: []
    })
    const kernel = new RuntimeKernel({
      graph: productionKernelV3Graph(),
      snapshots,
      events: runEvents,
      leases: snapshots,
      holderId: 'migration-test',
      nowIso: () => '2026-07-16T00:00:00.000Z',
      nodes: {
        ...handlers,
        'build-context': () => ({ condition: 'next', value: {} }),
        'invoke-model': () => ({ condition: 'next', value: final }),
        'commit-tools': () => {
          executions += 1
          return { outcome: { status: 'completed', reason: 'normal_stop', retryable: false } }
        }
      }
    })

    const outcome = await kernel.run(identity)
    await runtime.turns.finishTurn({
      threadId: identity.threadId,
      turnId: identity.turnId,
      status: 'completed'
    })

    expect(outcome).toMatchObject({ status: 'completed' })
    expect(executions).toBe(0)
    const items = await runtime.sessionStore.loadItems(identity.threadId)
    expect(items.find((item) => item.id === preparedCall.id)).toMatchObject({
      status: 'aborted',
      finishedAt: '2026-07-16T00:00:00.000Z'
    })
    expect(items).not.toContainEqual(expect.objectContaining({ kind: 'tool_result' }))
    expect(items).toContainEqual(expect.objectContaining({
      kind: 'assistant_text',
      text: 'Recovered final response.'
    }))
    expect((await runtime.threadStore.get(identity.threadId))?.turns[0]?.items.find(
      (item) => item.id === preparedCall.id
    )).toMatchObject({ status: 'aborted' })
    const updateEvents = (await runtime.sessionStore.loadEventsSince(identity.threadId, 0)).filter(
      (event) => event.kind === 'item_updated' && event.itemId === preparedCall.id
    )
    expect(updateEvents).toEqual([
      expect.objectContaining({
        kind: 'item_updated',
        itemId: preparedCall.id,
        item: expect.objectContaining({ status: 'aborted' })
      })
    ])
  })

  it('upgrades a v1 state past committed tools without retroactive execution', async () => {
    const snapshots = new InMemoryRunStateStore()
    const events = new InMemoryRunEventStore()
    await snapshots.save({
      ...oldState('build-context'),
      nodeData: {
        ...oldState('build-context').nodeData,
        'commit-tools': { callIds: ['call-1'], taskRevision: 2 }
      }
    })
    const buildContext = () => ({
      outcome: { status: 'completed', reason: 'normal_stop', retryable: false }
    } as const)
    const kernel = new RuntimeKernel({
      graph: productionKernelV3Graph(),
      snapshots,
      events,
      leases: snapshots,
      holderId: 'migration-test',
      nodes: { 'build-context': buildContext }
    })

    await expect(kernel.run(identity)).resolves.toMatchObject({ status: 'completed' })
    await expect(snapshots.load(identity)).resolves.toMatchObject({
      graphVersion: 'kernel-v3-production-v3'
    })
    expect((await events.listAfter(identity, 0))
      .filter((event) => event.eventType === 'node.started')
      .map((event) => event.stepId)).toEqual(['build-context'])
  })

  it('routes an in-flight v2 normalized proposal through model accounting once', async () => {
    const snapshots = new InMemoryRunStateStore()
    const events = new InMemoryRunEventStore()
    const proposal = modelProposal({
      proposalId: 'proposal-v2-accounting',
      usage: {
        promptTokens: 20,
        completionTokens: 5,
        totalTokens: 25,
        cacheHitRate: null,
        turns: 1,
        costUsd: 0.1
      }
    })
    await snapshots.save({
      ...oldState('evaluate', proposal),
      graphVersion: 'kernel-v3-production-v2'
    })
    const handlers = createKernelV3NodeHandlers({} as never)
    const kernel = new RuntimeKernel({
      graph: productionKernelV3Graph(),
      snapshots,
      events,
      leases: snapshots,
      holderId: 'migration-test',
      nodes: {
        'account-model': handlers['account-model']!,
        evaluate: () => ({
          outcome: { status: 'completed', reason: 'normal_stop', retryable: false }
        })
      }
    })

    await expect(kernel.run(identity)).resolves.toMatchObject({ status: 'completed' })
    await expect(snapshots.load(identity)).resolves.toMatchObject({
      graphVersion: 'kernel-v3-production-v3',
      budgets: { stepsUsed: 1, inputTokens: 20, outputTokens: 5, costUsd: 0.1 }
    })
    expect((await events.listAfter(identity, 0))
      .filter((event) => event.eventType === 'node.started')
      .map((event) => event.stepId)).toEqual(['account-model', 'evaluate'])
  })

  it('does not account stale v2 proposal data after entering the next model cycle', async () => {
    const snapshots = new InMemoryRunStateStore()
    const events = new InMemoryRunEventStore()
    await snapshots.save({
      ...oldState('build-context', modelProposal({ proposalId: 'proposal-already-processed' })),
      graphVersion: 'kernel-v3-production-v2'
    })
    const kernel = new RuntimeKernel({
      graph: productionKernelV3Graph(),
      snapshots,
      events,
      leases: snapshots,
      holderId: 'migration-test',
      nodes: { 'build-context': () => completeOutcome() }
    })

    await expect(kernel.run(identity)).resolves.toMatchObject({ status: 'completed' })
    await expect(snapshots.load(identity)).resolves.toMatchObject({
      graphVersion: 'kernel-v3-production-v3',
      budgets: { stepsUsed: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 }
    })
  })

  it('resumes the exact v2 cursor after accounting an already-evaluated proposal', async () => {
    const snapshots = new InMemoryRunStateStore()
    const events = new InMemoryRunEventStore()
    await snapshots.save({
      ...oldState('prepare-tools'),
      graphVersion: 'kernel-v3-production-v2'
    })
    const handlers = createKernelV3NodeHandlers({} as never)
    const kernel = new RuntimeKernel({
      graph: productionKernelV3Graph(),
      snapshots,
      events,
      leases: snapshots,
      holderId: 'migration-test',
      nodes: {
        'account-model': handlers['account-model']!,
        'prepare-tools': () => completeOutcome()
      }
    })

    await expect(kernel.run(identity)).resolves.toMatchObject({ status: 'completed' })
    expect((await events.listAfter(identity, 0))
      .filter((event) => event.eventType === 'node.started')
      .map((event) => event.stepId)).toEqual(['account-model', 'prepare-tools'])
  })

  it('re-enters prepare-tools for a v2 commit-tools snapshot to account prepared calls', async () => {
    const snapshots = new InMemoryRunStateStore()
    const events = new InMemoryRunEventStore()
    const proposal = modelProposal({
      proposalId: 'proposal-v2-prepared-tools',
      toolIntents: [
        { callId: 'call-1', toolName: 'read_data', arguments: {} },
        { callId: 'call-2', toolName: 'read_data', arguments: {} }
      ]
    })
    await snapshots.save({
      ...oldState('commit-tools', proposal),
      graphVersion: 'kernel-v3-production-v2',
      nodeData: {
        ...oldState('commit-tools', proposal).nodeData,
        'prepare-tools': { calls: proposal.toolIntents }
      }
    })
    const persistedItems = new Set<string>()
    const handlers = createKernelV3NodeHandlers({
      turns: {
        applyItemOnce: async (_threadId: string, item: TurnItem) => {
          persistedItems.add(item.id)
          return true
        }
      }
    } as never)
    const kernel = new RuntimeKernel({
      graph: productionKernelV3Graph(),
      snapshots,
      events,
      leases: snapshots,
      holderId: 'migration-test',
      nodes: {
        'account-model': handlers['account-model']!,
        'prepare-tools': handlers['prepare-tools']!,
        'commit-tools': () => completeOutcome()
      }
    })

    await expect(kernel.run(identity)).resolves.toMatchObject({ status: 'completed' })
    await expect(snapshots.load(identity)).resolves.toMatchObject({
      budgets: { stepsUsed: 1, toolCallsUsed: 2 }
    })
    expect(persistedItems).toEqual(new Set([
      `item_tool_${identity.turnId}_call-1`,
      `item_tool_${identity.turnId}_call-2`
    ]))
    expect((await events.listAfter(identity, 0))
      .filter((event) => event.eventType === 'node.started')
      .map((event) => event.stepId)).toEqual([
      'account-model',
      'prepare-tools',
      'commit-tools'
    ])
  })

  it('resumes an exact v1 recovery cursor after accounting without re-evaluation', async () => {
    const snapshots = new InMemoryRunStateStore()
    const events = new InMemoryRunEventStore()
    await snapshots.save({
      ...oldState('recover-context', modelProposal({
        proposalId: 'proposal-v1-recovery',
        usage: {
          promptTokens: 8,
          completionTokens: 2,
          totalTokens: 10,
          cacheHitRate: null,
          turns: 1,
          costUsd: 0.04
        }
      })),
      recovery: { attempts: 1, maxAttempts: 2, lastReason: 'context_discontinuity' }
    })
    const handlers = createKernelV3NodeHandlers({} as never)
    let evaluations = 0
    const kernel = new RuntimeKernel({
      graph: productionKernelV3Graph(),
      snapshots,
      events,
      leases: snapshots,
      holderId: 'migration-test',
      nodes: {
        'account-model': handlers['account-model']!,
        evaluate: () => {
          evaluations += 1
          return completeOutcome()
        },
        'recover-context': () => completeOutcome()
      }
    })

    await expect(kernel.run(identity)).resolves.toMatchObject({ status: 'completed' })
    expect(evaluations).toBe(0)
    await expect(snapshots.load(identity)).resolves.toMatchObject({
      budgets: { stepsUsed: 1, inputTokens: 8, outputTokens: 2, costUsd: 0.04 },
      recovery: { attempts: 1, maxAttempts: 2, lastReason: 'context_discontinuity' }
    })
    expect((await events.listAfter(identity, 0))
      .filter((event) => event.eventType === 'node.started')
      .map((event) => event.stepId)).toEqual(['account-model', 'recover-context'])
  })
})

function completeOutcome() {
  return { outcome: { status: 'completed', reason: 'normal_stop', retryable: false } } as const
}

function modelProposal(overrides: Partial<ModelProposal> = {}): ModelProposal {
  return {
    proposalId: 'proposal-migration',
    model: 'test-model',
    stopClass: 'tool_calls',
    integrity: {
      leakedProtocolText: false,
      malformedToolCall: false,
      completeToolCalls: true
    },
    reasoning: 'migration reasoning',
    text: 'migration text',
    toolIntents: [{ callId: 'call-1', toolName: 'read_data', arguments: {} }],
    ...overrides
  }
}

function oldState(nodeId: string, proposal: ModelProposal = modelProposal()): RunStateV3 {
  return {
    version: 3,
    graphVersion: 'kernel-v3-production-v1',
    runtimeMode: 'kernel_v3',
    ...identity,
    status: 'running',
    cursor: { stepIndex: 6, nodeId, attempt: 0, checkpointSeq: 0 },
    budgets: { stepsUsed: 0, toolCallsUsed: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
    recovery: { attempts: 0, maxAttempts: 1 },
    middleware: {},
    nodeData: {
      'normalize-proposal': proposal,
      'restore-task': task(),
      ...(nodeId === 'commit-tools'
        ? { 'prepare-tools': { calls: proposal.toolIntents } }
        : {})
    },
    taskRevision: 0,
    pendingEffects: [],
    committedEffects: [],
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z'
  }
}

function task(): TaskStateV1 {
  return {
    version: 1,
    identity,
    revision: 1,
    source: {
      objectiveItemId: 'user-1',
      sourceItemIds: ['user-1'],
      sourceDigest: 'source-1'
    },
    objective: '完成报告',
    constraints: [],
    completedActions: [],
    pendingActions: [{ id: 'next-1', text: '生成报告', status: 'pending', evidenceItemIds: [] }],
    activeSkillIds: [],
    artifacts: [],
    toolLedger: [],
    createdAt: 'now',
    updatedAt: 'now'
  }
}

async function createRealTurnRuntime() {
  const threadStore = new InMemoryThreadStore()
  const sessionStore = new InMemorySessionStore()
  const eventBus = new InMemoryEventBus()
  const turn = startTurn(createTurnRecord({
    id: identity.turnId,
    threadId: identity.threadId,
    prompt: 'continue',
    status: 'running',
    createdAt: '2026-07-16T00:00:00.000Z'
  }), '2026-07-16T00:00:00.000Z')
  await threadStore.upsert({
    ...createThreadRecord({
      id: identity.threadId,
      ownerUserId: identity.ownerUserId,
      title: 'migration',
      workspace: identity.workspaceKey,
      model: 'test-model',
      status: 'running',
      createdAt: '2026-07-16T00:00:00.000Z'
    }),
    turns: [turn]
  })
  const recorder = new RuntimeEventRecorder({
    eventBus,
    sessionStore,
    allocateSeq: (threadId) => eventBus.allocateSeq(threadId),
    nowIso: () => '2026-07-16T00:00:00.000Z'
  })
  const turns = new TurnService({
    threadStore,
    sessionStore,
    events: recorder,
    inflight: new InflightTracker(),
    steering: new SteeringQueue(),
    compactor: new ContextCompactor(),
    ids: new SequentialIdGenerator(),
    nowIso: () => '2026-07-16T00:00:00.000Z'
  })
  return { threadStore, sessionStore, turns }
}
