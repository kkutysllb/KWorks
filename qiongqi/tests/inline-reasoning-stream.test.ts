import { describe, expect, it } from 'vitest'
import { ModelCompatClient } from '@qiongqi/adapter-model'
import type { ModelRequest, ModelStreamChunk } from '@qiongqi/ports'

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

/** Build an SSE response body from a list of `delta.content` strings. */
function sseBody(contentDeltas: string[]): string {
  return contentDeltas
    .map((content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`)
    .join('') + 'data: [DONE]\n\n'
}

async function collectChunks(client: ModelCompatClient, model: string): Promise<ModelStreamChunk[]> {
  const chunks: ModelStreamChunk[] = []
  for await (const chunk of client.stream(makeRequest(model))) {
    chunks.push(chunk)
  }
  return chunks
}

function summarize(chunks: ModelStreamChunk[]): { text: string; reasoning: string } {
  let text = ''
  let reasoning = ''
  for (const chunk of chunks) {
    if (chunk.kind === 'assistant_text_delta') text += chunk.text
    else if (chunk.kind === 'assistant_reasoning_delta') reasoning += chunk.text
  }
  return { text, reasoning }
}

describe('ModelCompatClient inline reasoning extraction (MiniMax M3 style)', () => {
  it('extracts <mm:think> reasoning split across many chunks into assistant_reasoning_delta', async () => {
    // Simulate MiniMax M3 streaming: reasoning inline in content, split across
    // many small chunks (the scenario that broke stateless per-chunk stripping).
    const deltas = [
      '<mm:think>',
      'The user said hello. ',
      'I should respond politely.',
      '</mm:think>',
      'Hello! How can I help you today?'
    ]
    const client = new ModelCompatClient({
      baseUrl: 'https://api.minimaxi.com/v1',
      apiKey: 'sk-test',
      model: 'MiniMax-M3',
      endpointFormat: 'chat_completions',
      fetchImpl: async () => new Response(sseBody(deltas), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' }
      })
    })

    const chunks = await collectChunks(client, 'MiniMax-M3')
    const { text, reasoning } = summarize(chunks)

    expect(reasoning).toBe('The user said hello. I should respond politely.')
    expect(text).toBe('Hello! How can I help you today?')
  })

  it('does not leak reasoning into text when tags span chunk boundaries', async () => {
    // Tags themselves are split across chunks (not just the inner content).
    const deltas = [
      'Hello <mm:t',
      'hink>secret reasoning',
      '</mm:think> world'
    ]
    const client = new ModelCompatClient({
      baseUrl: 'https://api.minimaxi.com/v1',
      apiKey: 'sk-test',
      model: 'MiniMax-M3',
      endpointFormat: 'chat_completions',
      fetchImpl: async () => new Response(sseBody(deltas), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' }
      })
    })

    const chunks = await collectChunks(client, 'MiniMax-M3')
    const { text, reasoning } = summarize(chunks)

    expect(text).toBe('Hello  world')
    expect(reasoning).toBe('secret reasoning')
  })

  it('emits reasoning_delta chunks (not just text_delta) for inline tags', async () => {
    const deltas = ['<think>reasoning</think>visible']
    const client = new ModelCompatClient({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test',
      model: 'test-model',
      endpointFormat: 'chat_completions',
      fetchImpl: async () => new Response(sseBody(deltas), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' }
      })
    })

    const chunks = await collectChunks(client, 'test-model')
    const kinds = chunks.map((c) => c.kind)

    expect(kinds).toContain('assistant_reasoning_delta')
    expect(kinds).toContain('assistant_text_delta')
  })

  it('handles unclosed reasoning tag (flushes as reasoning at stream end)', async () => {
    const deltas = ['text before<think>reasoning that never closes']
    const client = new ModelCompatClient({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test',
      model: 'test-model',
      endpointFormat: 'chat_completions',
      fetchImpl: async () => new Response(sseBody(deltas), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' }
      })
    })

    const chunks = await collectChunks(client, 'test-model')
    const { text, reasoning } = summarize(chunks)

    expect(text).toBe('text before')
    expect(reasoning).toBe('reasoning that never closes')
  })

  it('passes plain text through unchanged (no false reasoning extraction)', async () => {
    const deltas = ['Hello! This is a normal response. 5 < 10 is true.']
    const client = new ModelCompatClient({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test',
      model: 'test-model',
      endpointFormat: 'chat_completions',
      fetchImpl: async () => new Response(sseBody(deltas), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' }
      })
    })

    const chunks = await collectChunks(client, 'test-model')
    const { text, reasoning } = summarize(chunks)

    expect(text).toBe('Hello! This is a normal response. 5 < 10 is true.')
    expect(reasoning).toBe('')
  })

  it('still extracts delta.reasoning_content (DeepSeek path) alongside inline extraction', async () => {
    // DeepSeek uses the dedicated reasoning_content field — that path must
    // remain intact even with the inline extractor active.
    const body = [
      'data: {"choices":[{"delta":{"reasoning_content":"deepseek reasoning"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"deepseek answer"}}]}\n\n',
      'data: [DONE]\n\n'
    ].join('')
    const client = new ModelCompatClient({
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test',
      model: 'deepseek-chat',
      endpointFormat: 'chat_completions',
      fetchImpl: async () => new Response(body, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' }
      })
    })

    const chunks = await collectChunks(client, 'deepseek-chat')
    const { text, reasoning } = summarize(chunks)

    expect(text).toBe('deepseek answer')
    expect(reasoning).toBe('deepseek reasoning')
  })
})
