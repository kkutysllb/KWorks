import { describe, expect, it } from 'vitest'
import { UserScopedModelClient, type KWorksUserDataStore } from '@qiongqi/http'
import type { ModelClient, ModelRequest, ModelStreamChunk } from '@qiongqi/ports'
import type { ThreadService } from '@qiongqi/services'

describe('UserScopedModelClient', () => {
  it('routes model requests through the owning user profile instead of global runtime state', async () => {
    const calls: Array<{ url: string; authorization: string | null; body: Record<string, unknown> }> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({
        url: String(input),
        authorization: new Headers(init?.headers).get('authorization'),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>
      })
      return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' }
      })
    }
    const store = makeStore({
      userA: {
        profiles: {
          shared: {
            providerModel: 'provider-a',
            baseUrl: 'https://a.example/v1',
            apiKey: 'key-a',
            endpointFormat: 'chat_completions'
          }
        }
      },
      userB: {
        profiles: {
          shared: {
            providerModel: 'provider-b',
            baseUrl: 'https://b.example/v1',
            apiKey: 'key-b',
            endpointFormat: 'chat_completions'
          }
        }
      }
    })
    const client = new UserScopedModelClient({
      fallback: fallbackClient(),
      threadService: {
        get: async (threadId: string) => ({
          id: threadId,
          ownerUserId: threadId === 'thread-a' ? 'userA' : 'userB'
        })
      } as unknown as ThreadService,
      userDataStore: store,
      fetchImpl
    })

    await drain(client.stream(request('thread-a', 'shared')))
    await drain(client.stream(request('thread-b', 'shared')))

    expect(calls).toMatchObject([
      {
        url: 'https://a.example/v1/chat/completions',
        authorization: 'Bearer key-a',
        body: { model: 'provider-a' }
      },
      {
        url: 'https://b.example/v1/chat/completions',
        authorization: 'Bearer key-b',
        body: { model: 'provider-b' }
      }
    ])
  })

  it('does not route ambiguous provider model names to the first matching profile', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({
        url: String(input),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>
      })
      return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' }
      })
    }
    const store = makeStore({
      userA: {
        activeModel: 'deepseek-official',
        profiles: {
          'deepseek-local': {
            providerModel: 'deepseek-chat',
            baseUrl: 'http://111.19.156.30:8006/v1',
            apiKey: 'local-key',
            endpointFormat: 'chat_completions'
          },
          'deepseek-official': {
            providerModel: 'deepseek-chat',
            baseUrl: 'https://api.deepseek.com/v1',
            apiKey: 'official-key',
            endpointFormat: 'chat_completions'
          }
        }
      }
    })
    const fallback = fallbackClient([
      { kind: 'completed', stopReason: 'stop' }
    ])
    const client = new UserScopedModelClient({
      fallback,
      threadService: {
        get: async (threadId: string) => ({
          id: threadId,
          ownerUserId: 'userA'
        })
      } as unknown as ThreadService,
      userDataStore: store,
      fetchImpl
    })

    await drain(client.stream(request('thread-a', 'deepseek-chat')))

    expect(calls).toEqual([])
  })

  it('passes the runtime stream idle timeout into user-scoped profile clients', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(new ReadableStream<Uint8Array>({
        start() {
          // Keep the provider stream open without chunks so the adapter timeout is observable.
        }
      }), { status: 200, headers: { 'content-type': 'text/event-stream' } })
    const store = makeStore({
      userA: {
        profiles: {
          minimax: {
            providerModel: 'MiniMax-M3',
            baseUrl: 'https://api.minimax.example/v1',
            apiKey: 'key-minimax',
            endpointFormat: 'chat_completions'
          }
        }
      }
    })
    const controller = new AbortController()
    const client = new UserScopedModelClient({
      fallback: fallbackClient(),
      threadService: {
        get: async (threadId: string) => ({
          id: threadId,
          ownerUserId: 'userA'
        })
      } as unknown as ThreadService,
      userDataStore: store,
      fetchImpl,
      streamIdleTimeoutMs: 5
    })

    const result = await Promise.race([
      collectUntilError(client.stream({ ...request('thread-a', 'minimax'), abortSignal: controller.signal })),
      new Promise<'timed-out'>((resolve) => setTimeout(() => resolve('timed-out'), 50))
    ])
    controller.abort()

    expect(result).not.toBe('timed-out')
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'error', code: 'stream_idle_timeout' })
      ])
    )
  })
})

function fallbackClient(chunks: ModelStreamChunk[] = [{ kind: 'error', message: 'fallback should not be used' }]): ModelClient {
  return {
    provider: 'fallback',
    model: 'fallback',
    async *stream(): AsyncIterable<ModelStreamChunk> {
      for (const chunk of chunks) yield chunk
    }
  }
}

function makeStore(users: Record<string, { activeModel?: string; profiles: Record<string, Record<string, unknown>> }>): KWorksUserDataStore {
  return {
    loadAuth: async () => ({ users: [], sessions: [] }),
    saveAuth: async () => undefined,
    listModelProfiles: async (userId) => ({
      activeModel: users[userId]?.activeModel ?? 'shared',
      profiles: users[userId]?.profiles ?? {}
    }),
    saveModelProfile: async () => undefined,
    deleteModelProfile: async () => undefined,
    activateModelProfile: async () => undefined,
    resolveModelSecret: async () => ({})
  } as KWorksUserDataStore
}

function request(threadId: string, model: string): ModelRequest {
  return {
    threadId,
    turnId: `turn-${threadId}`,
    model,
    prefix: [],
    history: [],
    tools: [],
    abortSignal: new AbortController().signal
  }
}

async function drain(iterable: AsyncIterable<unknown>): Promise<void> {
  for await (const _ of iterable) {
    // drain
  }
}

async function collectUntilError(iterable: AsyncIterable<ModelStreamChunk>): Promise<ModelStreamChunk[]> {
  const chunks: ModelStreamChunk[] = []
  for await (const chunk of iterable) {
    chunks.push(chunk)
    if (chunk.kind === 'error') break
  }
  return chunks
}
