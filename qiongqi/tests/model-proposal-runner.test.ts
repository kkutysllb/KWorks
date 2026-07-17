import { describe, expect, it } from 'vitest'
import type { UsageSnapshot } from '@qiongqi/contracts'
import { ModelProposalRunner } from '@qiongqi/loop'
import type { ModelClient, ModelRequest } from '@qiongqi/ports'

const request = {
  threadId: 'thread-1',
  turnId: 'turn-1',
  model: 'test-model',
  prefix: [],
  history: [],
  tools: [],
  abortSignal: new AbortController().signal
} as ModelRequest

function usage(promptTokens: number, completionTokens: number): UsageSnapshot {
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    cacheHitRate: null,
    turns: 1,
    costUsd: (promptTokens + completionTokens) / 1_000
  }
}

describe('ModelProposalRunner usage', () => {
  it('attaches the latest cumulative provider usage snapshot', async () => {
    const first = usage(10, 2)
    const latest = usage(10, 5)
    const seen: string[] = []
    const client: ModelClient = {
      provider: 'test-provider',
      model: 'test-model',
      async *stream() {
        yield { kind: 'assistant_text_delta', text: 'done' }
        yield { kind: 'usage', usage: first }
        yield { kind: 'usage', usage: latest }
        yield { kind: 'completed', stopReason: 'stop' }
      }
    }

    const proposal = await new ModelProposalRunner({
      client,
      onDelta: (chunk) => seen.push(chunk.kind)
    }).run(request)

    expect(proposal.usage).toEqual(latest)
    expect(seen).toEqual(['assistant_text_delta', 'usage', 'usage', 'completed'])
  })

  it('notifies accounting observers once with the latest usage after streaming', async () => {
    const first = usage(10, 2)
    const latest = usage(10, 5)
    const order: string[] = []
    const recorded: UsageSnapshot[] = []
    const client: ModelClient = {
      provider: 'test-provider',
      model: 'test-model',
      async *stream() {
        yield { kind: 'usage', usage: first }
        yield { kind: 'assistant_text_delta', text: 'done' }
        yield { kind: 'usage', usage: latest }
        yield { kind: 'completed', stopReason: 'stop' }
      }
    }

    await new ModelProposalRunner({
      client,
      onDelta: (chunk) => order.push(`delta:${chunk.kind}`),
      onUsage: (snapshot) => {
        order.push('usage:final')
        recorded.push(snapshot)
      }
    } as never).run(request)

    expect(recorded).toEqual([latest])
    expect(order).toEqual([
      'delta:usage',
      'delta:assistant_text_delta',
      'delta:usage',
      'delta:completed',
      'usage:final'
    ])
  })

  it('leaves usage undefined when the provider emits no usage snapshot', async () => {
    const client: ModelClient = {
      provider: 'test-provider',
      model: 'test-model',
      async *stream() {
        yield { kind: 'assistant_text_delta', text: 'done' }
        yield { kind: 'completed', stopReason: 'stop' }
      }
    }

    const proposal = await new ModelProposalRunner({ client }).run(request)

    expect(proposal.usage).toBeUndefined()
  })
})
