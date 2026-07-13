import { describe, expect, it } from 'vitest'
import { InlineReasoningExtractor } from './inline-reasoning-extractor.js'

function runChunks(chunks: string[]): { text: string; reasoning: string } {
  const ext = new InlineReasoningExtractor()
  let text = ''
  let reasoning = ''
  for (const chunk of chunks) {
    const out = ext.push(chunk)
    text += out.text
    reasoning += out.reasoning
  }
  const flushed = ext.flush()
  text += flushed.text
  reasoning += flushed.reasoning
  return { text, reasoning }
}

describe('InlineReasoningExtractor', () => {
  it('passes through plain text with no tags', () => {
    const result = runChunks(['Hello world'])
    expect(result.text).toBe('Hello world')
    expect(result.reasoning).toBe('')
  })

  it('extracts a paired tag in a single chunk', () => {
    const result = runChunks(['<mm:think>reasoning here</mm:think>visible text'])
    expect(result.text).toBe('visible text')
    expect(result.reasoning).toBe('reasoning here')
  })

  it('extracts paired tags split across chunks (content split)', () => {
    const result = runChunks([
      '<mm:think>reason',
      'ing here</mm:think>visible text'
    ])
    expect(result.text).toBe('visible text')
    expect(result.reasoning).toBe('reasoning here')
  })

  it('extracts when open and close tags are in separate chunks', () => {
    const result = runChunks([
      '<mm:think>',
      'reasoning here',
      '</mm:think>visible text'
    ])
    expect(result.text).toBe('visible text')
    expect(result.reasoning).toBe('reasoning here')
  })

  it('handles tag name split across chunk boundary', () => {
    const result = runChunks([
      '<mm:t',
      'hink>reasoning here</mm:think>visible text'
    ])
    expect(result.text).toBe('visible text')
    expect(result.reasoning).toBe('reasoning here')
  })

  it('handles unclosed opener (flush emits accumulated reasoning)', () => {
    const result = runChunks(['<mm:think>reasoning never closes'])
    expect(result.text).toBe('')
    expect(result.reasoning).toBe('reasoning never closes')
  })

  it('handles multiple reasoning blocks with text between them', () => {
    const result = runChunks([
      'text1<think>r1</think>text2',
      '<think>r2</think>text3'
    ])
    expect(result.text).toBe('text1text2text3')
    expect(result.reasoning).toBe('r1r2')
  })

  it('supports all known tag names', () => {
    for (const tag of ['think', 'thinking', 'reasoning', 'reflection', 'mm:think', 'ask']) {
      const result = runChunks([`<${tag}>inner</${tag}>outer`])
      expect(result.text).toBe('outer')
      expect(result.reasoning).toBe('inner')
    }
  })

  it('is case-insensitive for tag names', () => {
    const result = runChunks(['<THINK>reasoning</THINK>text'])
    expect(result.text).toBe('text')
    expect(result.reasoning).toBe('reasoning')
  })

  it('does not treat normal angle brackets as tags', () => {
    const result = runChunks(['5 < 10 and 3 > 1'])
    expect(result.text).toBe('5 < 10 and 3 > 1')
    expect(result.reasoning).toBe('')
  })

  it('does not mistake prose like "I think" for a tag', () => {
    const result = runChunks(['I think this is correct'])
    expect(result.text).toBe('I think this is correct')
    expect(result.reasoning).toBe('')
  })

  it('handles empty reasoning content between tags', () => {
    const result = runChunks(['<think></think>visible'])
    expect(result.text).toBe('visible')
    expect(result.reasoning).toBe('')
  })

  it('handles reasoning block at the very end with no trailing text', () => {
    const result = runChunks(['text<think>reasoning</think>'])
    expect(result.text).toBe('text')
    expect(result.reasoning).toBe('reasoning')
  })

  it('handles a partial closer split across chunks', () => {
    const result = runChunks([
      '<think>reasoning</t',
      'hink>visible'
    ])
    expect(result.text).toBe('visible')
    expect(result.reasoning).toBe('reasoning')
  })

  it('emits text and reasoning incrementally across many small chunks', () => {
    const result = runChunks([
      'He', 'llo ', '<th', 'in', 'k>', 'rea', 'son', 'ing',
      '</', 'thi', 'nk>', ' wo', 'rld'
    ])
    expect(result.text).toBe('Hello  world')
    expect(result.reasoning).toBe('reasoning')
  })
})
