import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FileSessionStore, FileThreadStore, InMemoryEventBus } from '@qiongqi/adapter-storage'
import type { ModelProposal, TurnItem } from '@qiongqi/contracts'
import {
  appendTurnItem,
  createThreadRecord,
  createTurnRecord,
  makeAssistantReasoningItem,
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

const threadId = 'thread-persistence'
const turnId = 'turn-persistence'

describe('proposal materialization persistence', () => {
  let dataDir = ''

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'qiongqi-proposal-materialization-'))
  })

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true })
  })

  it('replay appends and emits creation exactly once per proposal item', async () => {
    const harness = await createHarness(dataDir)
    const proposal = modelProposal()

    await harness.materialize(proposal)
    await harness.materialize(proposal)

    await expect(rawItems(dataDir)).resolves.toHaveLength(2)
    const creationEvents = (await harness.sessionStore.loadEventsSince(threadId, 0))
      .filter((event) => event.kind === 'item_created')
    expect(creationEvents.map((event) => event.itemId)).toEqual([
      'item_kernel_reasoning_proposal-persistence',
      'item_kernel_text_proposal-persistence'
    ])
    expect((await harness.threadStore.get(threadId))?.turns[0]?.items.map((item) => item.id))
      .toEqual([
        'item_kernel_reasoning_proposal-persistence',
        'item_kernel_text_proposal-persistence'
      ])
  })

  it('partial replay retains existing reasoning and creates only the missing text', async () => {
    const harness = await createHarness(dataDir)
    const proposal = modelProposal()
    await harness.turns.applyItem(threadId, makeAssistantReasoningItem({
      id: 'item_kernel_reasoning_proposal-persistence',
      threadId,
      turnId,
      text: proposal.reasoning,
      status: 'completed'
    }))

    await harness.materialize(proposal)

    const items = await rawItems(dataDir)
    expect(items.map((item) => item.id)).toEqual([
      'item_kernel_reasoning_proposal-persistence',
      'item_kernel_text_proposal-persistence'
    ])
    const creationEvents = (await harness.sessionStore.loadEventsSince(threadId, 0))
      .filter((event) => event.kind === 'item_created')
    expect(creationEvents).toHaveLength(2)
  })

  it('repairs thread projection and creation event after only the session append committed', async () => {
    const harness = await createHarness(dataDir)
    const item = reasoningItem()
    await harness.sessionStore.appendItem(threadId, item)

    await harness.turns.applyItemOnce(threadId, item)

    await expectRepairedCreation(harness, item)
  })

  it('repairs the creation event after session and thread projection committed', async () => {
    const harness = await createHarness(dataDir)
    const item = reasoningItem()
    await harness.sessionStore.appendItem(threadId, item)
    const thread = await harness.threadStore.get(threadId)
    if (!thread?.turns[0]) throw new Error('seeded turn missing')
    await harness.threadStore.upsert({
      ...thread,
      turns: [appendTurnItem(thread.turns[0], item)]
    })

    await harness.turns.applyItemOnce(threadId, item)

    await expectRepairedCreation(harness, item)
  })
})

async function createHarness(dataDir: string) {
  const sessionStore = new FileSessionStore({ dataDir })
  const threadStore = new FileThreadStore({ dataDir })
  const thread = createThreadRecord({
    id: threadId,
    ownerUserId: 'owner-persistence',
    title: 'persistence',
    workspace: '/workspace-persistence',
    model: 'test-model',
    status: 'running',
    createdAt: '2026-07-16T00:00:00.000Z'
  })
  await threadStore.upsert({
    ...thread,
    turns: [startTurn(createTurnRecord({
      id: turnId,
      threadId,
      prompt: 'continue',
      status: 'running',
      createdAt: '2026-07-16T00:00:00.000Z'
    }), '2026-07-16T00:00:00.000Z')]
  })
  const eventBus = new InMemoryEventBus()
  const turns = new TurnService({
    threadStore,
    sessionStore,
    events: new RuntimeEventRecorder({
      eventBus,
      sessionStore,
      allocateSeq: (id) => eventBus.allocateSeq(id),
      nowIso: () => '2026-07-16T00:00:00.000Z'
    }),
    inflight: new InflightTracker(),
    steering: new SteeringQueue(),
    compactor: new ContextCompactor(),
    ids: new SequentialIdGenerator(),
    nowIso: () => '2026-07-16T00:00:00.000Z'
  })
  const handlers = createKernelV3NodeHandlers({ turns } as never)
  return {
    dataDir,
    sessionStore,
    threadStore,
    turns,
    materialize: (proposal: ModelProposal) => handlers['materialize-proposal']?.({
      identity: {
        ownerUserId: 'owner-persistence',
        workspaceKey: '/workspace-persistence',
        threadId,
        turnId,
        runId: 'run-persistence'
      },
      state: { nodeData: { 'normalize-proposal': proposal } }
    } as never)
  }
}

async function expectRepairedCreation(
  harness: Awaited<ReturnType<typeof createHarness>>,
  item: TurnItem
): Promise<void> {
  expect((await rawItems(harness.dataDir)).filter((stored) => stored.id === item.id))
    .toHaveLength(1)
  expect((await harness.threadStore.get(threadId))?.turns[0]?.items)
    .toContainEqual(expect.objectContaining({ id: item.id }))
  expect((await harness.sessionStore.loadEventsSince(threadId, 0)).filter(
    (event) => event.kind === 'item_created' && event.itemId === item.id
  )).toHaveLength(1)
}

async function rawItems(dataDir: string): Promise<TurnItem[]> {
  const contents = await readFile(join(dataDir, 'threads', threadId, 'messages.jsonl'), 'utf-8')
  return contents.trim().split('\n').map((line) => JSON.parse(line) as TurnItem)
}

function modelProposal(): ModelProposal {
  return {
    proposalId: 'proposal-persistence',
    model: 'test-model',
    stopClass: 'tool_calls',
    integrity: {
      leakedProtocolText: false,
      malformedToolCall: false,
      completeToolCalls: true
    },
    reasoning: 'reasoning',
    text: 'text',
    toolIntents: [{ callId: 'call-1', toolName: 'read_data', arguments: {} }]
  }
}

function reasoningItem(): TurnItem {
  return makeAssistantReasoningItem({
    id: 'item_kernel_reasoning_proposal-persistence',
    threadId,
    turnId,
    text: 'reasoning',
    status: 'completed'
  })
}
