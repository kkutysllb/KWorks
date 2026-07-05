import { describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LocalToolHost } from '@qiongqi/adapter-tools'
import { ContextCompactor, estimateModelRequestInputTokens } from '@qiongqi/loop'
import { makeAssistantTextItem } from '@qiongqi/domain'
import type { ModelClient, ModelRequest, ModelStreamChunk } from '@qiongqi/ports'
import { bootstrapThread, makeHarness } from './loop-test-harness.js'

describe('prompt budget protections', () => {
  it('externalizes oversized tool output before it becomes model-bound history', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qiongqi-loop-budget-'))
    const seenRequests: ModelRequest[] = []
    let calls = 0
    const model: ModelClient = {
      provider: 'capture',
      model: 'capture',
      async *stream(request): AsyncIterable<ModelStreamChunk> {
        seenRequests.push(request)
        calls += 1
        if (calls === 1) {
          yield {
            kind: 'tool_call_complete',
            callId: 'call_loud',
            toolName: 'loud',
            arguments: {}
          }
          yield { kind: 'completed', stopReason: 'tool_calls' }
          return
        }
        yield { kind: 'completed', stopReason: 'stop' }
      }
    }
    const loudTool = LocalToolHost.defineTool({
      name: 'loud',
      description: 'Return a large output.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      policy: 'auto',
      execute: async () => ({ output: `head-${'x'.repeat(200_000)}-tail` })
    })
    const h = makeHarness(model, {
      tools: [loudTool],
      runtimeDataDir: dir,
      compactor: new ContextCompactor({ softThreshold: 900_000, hardThreshold: 1_000_000 })
    })
    try {
      await bootstrapThread(h)

      const status = await h.loop.runTurn(h.threadId, h.turnId)
      const secondHistory = JSON.stringify(seenRequests[1]?.history ?? [])

      expect(status).toBe('completed')
      expect(seenRequests).toHaveLength(2)
      expect(secondHistory).toContain('tool output omitted')
      expect(secondHistory).toContain('Full output:')
      expect(secondHistory).not.toContain('x'.repeat(10_000))
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('keeps the final model request under the compactor hard cap when recent assistant text is huge', async () => {
    const seenRequests: ModelRequest[] = []
    const model: ModelClient = {
      provider: 'capture',
      model: 'capture',
      async *stream(request): AsyncIterable<ModelStreamChunk> {
        seenRequests.push(request)
        yield { kind: 'completed', stopReason: 'stop' }
      }
    }
    const h = makeHarness(model, {
      tools: [],
      compactor: new ContextCompactor({ softThreshold: 128, hardThreshold: 512 })
    })
    await bootstrapThread(h)
    await h.sessionStore.appendItem(
      h.threadId,
      makeAssistantTextItem({
        id: 'assistant_huge_recent',
        threadId: h.threadId,
        turnId: h.turnId,
        text: `draft-${'A'.repeat(8_000)}-end`,
        status: 'completed'
      })
    )

    await h.loop.runTurn(h.threadId, h.turnId)
    const request = seenRequests[0]
    const modelBoundHistory = JSON.stringify(request?.history ?? [])

    expect(request).toBeDefined()
    expect(estimateModelRequestInputTokens(request!)).toBeLessThanOrEqual(512)
    expect(modelBoundHistory).toContain('truncated for model input budget')
    expect(modelBoundHistory).not.toContain('A'.repeat(1_000))
  })
})
