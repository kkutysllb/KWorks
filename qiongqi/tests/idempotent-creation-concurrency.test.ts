import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  FileSessionStore,
  HybridSessionStore,
  HybridThreadStore,
  InMemoryEventBus,
  InMemorySessionStore
} from '@qiongqi/adapter-storage'
import type { TurnItem } from '@qiongqi/contracts'
import { makeAssistantReasoningItem } from '@qiongqi/domain'
import type { SessionStore } from '@qiongqi/ports'
import { RuntimeEventRecorder } from '@qiongqi/services'

const threadId = 'thread-concurrent-item'
const turnId = 'turn-concurrent-item'
const temporaryDirectories: string[] = []
const hybridStores: HybridThreadStore[] = []

afterEach(async () => {
  for (const store of hybridStores.splice(0)) store.close()
  await Promise.all(temporaryDirectories.splice(0).map(
    (directory) => rm(directory, { recursive: true, force: true })
  ))
})

describe('idempotent creation concurrency', () => {
  it('selects one canonical item in the in-memory session store', async () => {
    await expectConcurrentAppend(new InMemorySessionStore())
  })

  it('selects one canonical item in the file session store', async () => {
    const dataDir = await temporaryDirectory('qiongqi-file-item-once-')
    await expectConcurrentAppend(new FileSessionStore({ dataDir }))
  })

  it('selects one canonical item in the hybrid session store', async () => {
    const dataDir = await temporaryDirectory('qiongqi-hybrid-item-once-')
    const index = new HybridThreadStore({ dataDir })
    await index.ready()
    hybridStores.push(index)
    await expectConcurrentAppend(new HybridSessionStore({ dataDir, index }))
  })

  it('records one durable event for concurrent recordOnce calls', async () => {
    const sessionStore = new InMemorySessionStore()
    const eventBus = new InMemoryEventBus()
    const recorder = new RuntimeEventRecorder({
      eventBus,
      sessionStore,
      allocateSeq: (id) => eventBus.allocateSeq(id),
      nowIso: () => '2026-07-16T00:00:00.000Z'
    })
    const item = candidateItem(0)
    const results = await Promise.all(Array.from({ length: 8 }, () => recorder.recordOnce({
      kind: 'item_created',
      threadId,
      turnId,
      itemId: item.id,
      item
    }, (event) => event.kind === 'item_created' && event.itemId === item.id)))

    expect(await sessionStore.loadEventsSince(threadId, 0)).toHaveLength(1)
    expect(eventBus.snapshotSince(threadId, 0)).toHaveLength(1)
    for (const event of results) expect(event).toEqual(results[0])
  })
})

async function expectConcurrentAppend(store: SessionStore): Promise<void> {
  const results = await Promise.all(
    Array.from({ length: 8 }, (_, index) => store.appendItemOnce(
      threadId,
      candidateItem(index)
    ))
  )
  const created = results.filter((result) => result.created)

  expect(created).toHaveLength(1)
  for (const result of results) expect(result.item).toEqual(results[0]?.item)
  await expect(store.loadItems(threadId)).resolves.toEqual([created[0]?.item])
}

function candidateItem(index: number): TurnItem {
  return {
    ...makeAssistantReasoningItem({
      id: 'item_kernel_reasoning_proposal-concurrent',
      threadId,
      turnId,
      text: 'canonical reasoning',
      status: 'completed'
    }),
    createdAt: `2026-07-16T00:00:0${index}.000Z`
  }
}

async function temporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  temporaryDirectories.push(directory)
  return directory
}
