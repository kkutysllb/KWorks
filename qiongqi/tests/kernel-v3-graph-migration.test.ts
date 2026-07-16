import { describe, expect, it } from 'vitest'
import { InMemoryRunEventStore, InMemoryRunStateStore } from '@qiongqi/adapter-storage'
import type { ModelProposal, RunIdentity, RunStateV3, TurnItem } from '@qiongqi/contracts'
import { makeToolCallItem } from '@qiongqi/domain'
import {
  RuntimeKernel,
  createKernelV3NodeHandlers,
  productionKernelV3Graph
} from '@qiongqi/loop'

const identity: RunIdentity = {
  ownerUserId: 'owner-migration',
  workspaceKey: '/workspace-migration',
  threadId: 'thread-migration',
  turnId: 'turn-migration',
  runId: 'run-migration'
}

describe('production kernel graph migration', () => {
  it('reports production graph version v2', () => {
    expect(productionKernelV3Graph().version).toBe('kernel-v3-production-v2')
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
        'materialize-proposal',
        'prepare-tools',
        'commit-tools'
      ])
      await expect(snapshots.load(identity)).resolves.toMatchObject({
        graphVersion: 'kernel-v3-production-v2'
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
      graphVersion: 'kernel-v3-production-v2'
    })
    expect((await events.listAfter(identity, 0))
      .filter((event) => event.eventType === 'node.started')
      .map((event) => event.stepId)).toEqual(['build-context'])
  })
})

function oldState(nodeId: string): RunStateV3 {
  const proposal: ModelProposal = {
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
    toolIntents: [{ callId: 'call-1', toolName: 'read_data', arguments: {} }]
  }
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
