import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  FileSessionStore,
  FileThreadStore,
  InMemoryEventBus
} from '@qiongqi/adapter-storage'
import type { ModelProposal, RunIdentity, RunStateV3, TaskStateV1, TurnItem } from '@qiongqi/contracts'
import {
  createThreadRecord,
  createTurnRecord,
  makeToolCallItem,
  startTurn
} from '@qiongqi/domain'
import {
  ContextCompactor,
  InflightTracker,
  SteeringQueue,
  createKernelV3NodeHandlers
} from '@qiongqi/loop'
import { SequentialIdGenerator } from '@qiongqi/ports'
import { RuntimeEventRecorder, TurnService } from '@qiongqi/services'

const identity: RunIdentity = {
  ownerUserId: 'owner-reconciliation',
  workspaceKey: '/workspace-reconciliation',
  threadId: 'thread-reconciliation',
  turnId: 'turn-reconciliation',
  runId: 'run-reconciliation'
}
const abortFinishedAt = '2026-07-16T00:00:05.000Z'
const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(
    (directory) => rm(directory, { recursive: true, force: true })
  ))
})

describe('migrated prepared-call reconciliation replay', () => {
  it('repairs remaining calls without duplicating a previously committed abort', async () => {
    const harness = await createHarness(['call-1', 'call-2'])
    await harness.turns.updateItem(identity.threadId, itemId('call-1'), abortPatch())
    const state = reconciliationState(contextLossProposal(), ['call-1', 'call-2'])

    const first = await harness.evaluate(state)
    const replay = await harness.evaluate(state)

    expect(first?.condition).toBe('recover')
    expect(replay?.condition).toBe('recover')
    await expectCanonicalAborts(harness, ['call-1', 'call-2'])
  })

  it.each([
    ['recover', contextLossProposal()],
    ['fatal', proposal({ stopClass: 'safety', text: '', reasoning: '', toolIntents: [] })],
    ['final', proposal({ stopClass: 'normal', text: 'done', reasoning: '', toolIntents: [] })]
  ] as const)('does not duplicate fully committed aborts before a %s decision', async (
    condition,
    modelProposal
  ) => {
    const harness = await createHarness(['call-1'])
    await harness.turns.updateItem(identity.threadId, itemId('call-1'), abortPatch())
    const state = reconciliationState(modelProposal, ['call-1'])

    expect((await harness.evaluate(state))?.condition).toBe(condition)
    expect((await harness.evaluate(state))?.condition).toBe(condition)

    await expectCanonicalAborts(harness, ['call-1'])
  })
})

async function createHarness(callIds: string[]) {
  const dataDir = await mkdtemp(join(tmpdir(), 'qiongqi-reconciliation-replay-'))
  temporaryDirectories.push(dataDir)
  const sessionStore = new FileSessionStore({ dataDir })
  const threadStore = new FileThreadStore({ dataDir })
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
      title: 'reconciliation',
      workspace: identity.workspaceKey,
      model: 'test-model',
      status: 'running',
      createdAt: '2026-07-16T00:00:00.000Z'
    }),
    turns: [turn]
  })
  const eventBus = new InMemoryEventBus()
  const recorder = new RuntimeEventRecorder({
    eventBus,
    sessionStore,
    allocateSeq: (threadId) => eventBus.allocateSeq(threadId),
    nowIso: () => abortFinishedAt
  })
  const turns = new TurnService({
    threadStore,
    sessionStore,
    events: recorder,
    inflight: new InflightTracker(),
    steering: new SteeringQueue(),
    compactor: new ContextCompactor(),
    ids: new SequentialIdGenerator(),
    nowIso: () => abortFinishedAt
  })
  for (const callId of callIds) {
    await turns.applyItemOnce(identity.threadId, makeToolCallItem({
      id: itemId(callId),
      threadId: identity.threadId,
      turnId: identity.turnId,
      callId,
      toolName: 'read_data',
      arguments: {},
      status: 'running'
    }))
  }
  const handlers = createKernelV3NodeHandlers({
    turns,
    nowIso: () => 'different-on-retry'
  } as never)
  return {
    dataDir,
    sessionStore,
    threadStore,
    turns,
    evaluate: (state: RunStateV3) => handlers.evaluate?.({ identity, state } as never)
  }
}

async function expectCanonicalAborts(
  harness: Awaited<ReturnType<typeof createHarness>>,
  callIds: string[]
): Promise<void> {
  const raw = await rawItems(harness.dataDir)
  const sessionItems = await harness.sessionStore.loadItems(identity.threadId)
  const thread = await harness.threadStore.get(identity.threadId)
  const updateEvents = (await harness.sessionStore.loadEventsSince(identity.threadId, 0))
    .filter((event) => event.kind === 'item_updated')
  for (const callId of callIds) {
    const id = itemId(callId)
    expect(raw.filter((item) => item.id === id)).toHaveLength(2)
    expect(updateEvents.filter((event) => event.itemId === id)).toHaveLength(1)
    const sessionItem = sessionItems.find((item) => item.id === id)
    const threadItem = thread?.turns[0]?.items.find((item) => item.id === id)
    const eventItem = updateEvents.find((event) => event.itemId === id)?.item
    expect(sessionItem).toMatchObject(abortPatch())
    expect(threadItem).toEqual(sessionItem)
    expect(eventItem).toEqual(sessionItem)
  }
}

function reconciliationState(modelProposal: ModelProposal, callIds: string[]): RunStateV3 {
  return {
    version: 3,
    graphVersion: 'kernel-v3-production-v2',
    runtimeMode: 'kernel_v3',
    ...identity,
    status: 'running',
    cursor: { stepIndex: 6, nodeId: 'evaluate', attempt: 0, checkpointSeq: 0 },
    budgets: { stepsUsed: 0, toolCallsUsed: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
    recovery: { attempts: 0, maxAttempts: 1 },
    middleware: {},
    nodeData: {
      'normalize-proposal': modelProposal,
      'restore-task': task(),
      'v1-proposal-migration': {
        sourceNodeId: 'commit-tools',
        preparedCallIds: callIds,
        reconciled: false,
        abortFinishedAt
      }
    },
    taskRevision: 1,
    pendingEffects: [],
    committedEffects: [],
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z'
  }
}

function contextLossProposal(): ModelProposal {
  return proposal({ reasoning: 'What should I continue with?', text: '' })
}

function proposal(overrides: Partial<ModelProposal>): ModelProposal {
  return {
    proposalId: 'proposal-reconciliation',
    model: 'test-model',
    stopClass: 'tool_calls',
    integrity: {
      leakedProtocolText: false,
      malformedToolCall: false,
      completeToolCalls: true
    },
    reasoning: '',
    text: '',
    toolIntents: [{ callId: 'call-1', toolName: 'read_data', arguments: {} }],
    ...overrides
  }
}

function task(): TaskStateV1 {
  return {
    version: 1,
    identity,
    revision: 1,
    source: { objectiveItemId: 'user-1', sourceItemIds: ['user-1'], sourceDigest: 'source-1' },
    objective: 'complete report',
    constraints: [],
    completedActions: [],
    pendingActions: [{ id: 'next-1', text: 'continue', status: 'pending', evidenceItemIds: [] }],
    activeSkillIds: [],
    artifacts: [],
    toolLedger: [],
    createdAt: 'now',
    updatedAt: 'now'
  }
}

function abortPatch(): Partial<TurnItem> {
  return { status: 'aborted', finishedAt: abortFinishedAt }
}

function itemId(callId: string): string {
  return `item_tool_${identity.turnId}_${callId}`
}

async function rawItems(dataDir: string): Promise<TurnItem[]> {
  const contents = await readFile(
    join(dataDir, 'threads', identity.threadId, 'messages.jsonl'),
    'utf-8'
  )
  return contents.trim().split('\n').map((line) => JSON.parse(line) as TurnItem)
}
