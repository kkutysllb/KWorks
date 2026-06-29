import { describe, expect, it } from 'vitest'
import { recordToolCatalogDrift } from '@qiongqi/loop/loop-events'
import type { RuntimeEvent } from '@qiongqi/contracts'

describe('loop events', () => {
  it('records tool catalog drift without appending a transcript item', async () => {
    const appliedItems: unknown[] = []
    const events: RuntimeEvent[] = []

    await recordToolCatalogDrift(
      {
        applyItem: async (_threadId: string, item: unknown) => {
          appliedItems.push(item)
        }
      } as never,
      {
        record: async (event: RuntimeEvent) => {
          events.push(event)
        }
      } as never,
      {
        threadId: 'thread-1',
        turnId: 'turn-1',
        fingerprint: 'fp-2',
        toolCount: 2,
        toolNames: ['read', 'edit'],
        changeKind: 'additive',
        message: 'Tool catalog changed'
      }
    )

    expect(appliedItems).toEqual([])
    expect(events).toEqual([
      expect.objectContaining({
        kind: 'tool_catalog_changed',
        threadId: 'thread-1',
        turnId: 'turn-1',
        fingerprint: 'fp-2',
        toolCount: 2,
        changeKind: 'additive',
        toolNames: ['read', 'edit'],
        message: 'Tool catalog changed'
      })
    ])
  })
})
