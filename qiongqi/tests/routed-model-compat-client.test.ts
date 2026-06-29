import { describe, expect, it } from 'vitest'
import { DynamicRoutedModelCompatClient, RoutedModelCompatClient } from '@qiongqi/adapter-model'
import type { ModelRequest } from '@qiongqi/ports'

function makeRequest(model: string): ModelRequest {
  return {
    threadId: 'thr_1',
    turnId: 'turn_1',
    model,
    prefix: [],
    history: [],
    tools: [],
    abortSignal: new AbortController().signal
  }
}

describe('RoutedModelCompatClient', () => {
  it('routes model requests to the matching provider endpoint and key', async () => {
    const calls: Array<{ url: string; auth: string | null; body: Record<string, unknown> }> = []
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({
        url: String(url),
        auth: init?.headers instanceof Headers
          ? init.headers.get('authorization')
          : (init?.headers as Record<string, string> | undefined)?.Authorization ?? null,
        body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      })
      return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' }
      })
    }
    const client = new RoutedModelCompatClient({
      fallback: {
        baseUrl: 'https://fallback.example/v1',
        apiKey: 'sk-fallback',
        model: 'fallback-model',
        fetchImpl
      },
      routes: [
        {
          baseUrl: 'https://flash.example/v1',
          apiKey: 'sk-flash',
          model: 'deepseek-v4-flash',
          aliases: ['DeepSeek-V4-Flash'],
          fetchImpl
        },
        {
          baseUrl: 'https://pro.example/v1',
          apiKey: 'sk-pro',
          model: 'deepseek-v4-pro',
          fetchImpl
        }
      ]
    })

    for await (const _chunk of client.stream(makeRequest('deepseek-v4-pro'))) {
      // drain stream
    }
    for await (const _chunk of client.stream(makeRequest('DeepSeek-V4-Flash'))) {
      // drain stream
    }
    for await (const _chunk of client.stream(makeRequest('unknown-model'))) {
      // drain stream
    }

    expect(calls).toHaveLength(3)
    expect(calls[0]).toMatchObject({
      url: 'https://pro.example/v1/chat/completions',
      auth: 'Bearer sk-pro',
      body: { model: 'deepseek-v4-pro' }
    })
    expect(calls[1]).toMatchObject({
      url: 'https://flash.example/v1/chat/completions',
      auth: 'Bearer sk-flash',
      body: { model: 'deepseek-v4-flash' }
    })
    expect(calls[2]).toMatchObject({
      url: 'https://fallback.example/v1/chat/completions',
      auth: 'Bearer sk-fallback',
      body: { model: 'unknown-model' }
    })
  })

  it('reloads routes from the provider and sends the provider model name', async () => {
    const calls: Array<{ url: string; auth: string | null; body: Record<string, unknown> }> = []
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({
        url: String(url),
        auth: init?.headers instanceof Headers
          ? init.headers.get('authorization')
          : (init?.headers as Record<string, string> | undefined)?.Authorization ?? null,
        body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      })
      return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' }
      })
    }
    let routes = [
      {
        baseUrl: 'https://deepseek.example/v1',
        apiKey: 'sk-deepseek',
        model: 'deepseek-chat',
        aliases: ['DeepSeek'],
        fetchImpl
      }
    ]
    const client = new DynamicRoutedModelCompatClient({
      fallback: {
        baseUrl: 'https://fallback.example/v1',
        apiKey: 'sk-fallback',
        model: 'fallback-model',
        fetchImpl
      },
      routes: () => routes
    })

    for await (const _chunk of client.stream(makeRequest('Z.AI'))) {
      // drain stream
    }
    routes = [
      ...routes,
      {
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        apiKey: 'sk-zhipu',
        model: 'glm-5.2',
        aliases: ['Z.AI', 'GLM-5.2'],
        fetchImpl
      }
    ]
    for await (const _chunk of client.stream(makeRequest('Z.AI'))) {
      // drain stream
    }

    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({
      url: 'https://fallback.example/v1/chat/completions',
      auth: 'Bearer sk-fallback',
      body: { model: 'Z.AI' }
    })
    expect(calls[1]).toMatchObject({
      url: 'https://open.bigmodel.cn/api/coding/paas/v4/chat/completions',
      auth: 'Bearer sk-zhipu',
      body: { model: 'glm-5.2' }
    })
  })

})
