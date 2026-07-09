import { describe, expect, test } from 'vitest'

import { stripInlineReasoningTags } from './reasoning-tags.js'

describe('stripInlineReasoningTags', () => {
  test('removes a paired <think> block', () => {
    expect(
      stripInlineReasoningTags('Hello<think>secret reasoning</think>World'),
    ).toBe('HelloWorld')
  })

  test('removes paired block with multiline inner content', () => {
    expect(
      stripInlineReasoningTags(
        'before<think>\nline one\nline two\n</think>after',
      ),
    ).toBe('beforeafter')
  })

  test('removes an unclosed <think> opener to end of text', () => {
    // Streaming mid-block: opener arrived, closer not yet.
    expect(
      stripInlineReasoningTags('Answer<think>still reasoning, no close'),
    ).toBe('Answer')
  })

  test('removes an orphaned </think> closer', () => {
    // Opener was in an earlier chunk; only the closer remains in this delta.
    expect(stripInlineReasoningTags('real answer</think>more text')).toBe(
      'real answermore text',
    )
  })

  test('handles <thinking> variant (paired)', () => {
    expect(
      stripInlineReasoningTags('Hi<thinking>deliberation</thinking>Done'),
    ).toBe('HiDone')
  })

  test('handles <reasoning> variant (unclosed)', () => {
    expect(
      stripInlineReasoningTags('Go<reasoning>endless reasoning here'),
    ).toBe('Go')
  })

  test('handles <reflection> variant (orphaned closer)', () => {
    expect(stripInlineReasoningTags('text</reflection>tail')).toBe('texttail')
  })

  test('removes multiple paired blocks', () => {
    expect(
      stripInlineReasoningTags(
        'a<think>1</think>b<think>2</think>c',
      ),
    ).toBe('abc')
  })

  test('returns empty string when only reasoning present', () => {
    expect(stripInlineReasoningTags('<think>all reasoning</think>')).toBe('')
  })

  test('does not touch unrelated angle-bracket tags', () => {
    expect(stripInlineReasoningTags('<div>hello</div>')).toBe(
      '<div>hello</div>',
    )
    expect(stripInlineReasoningTags('<b>bold</b>')).toBe('<b>bold</b>')
  })

  test('does not touch prose that mentions think in a sentence', () => {
    expect(stripInlineReasoningTags('I think this works')).toBe(
      'I think this works',
    )
  })

  test('handles case-insensitive tag names', () => {
    expect(
      stripInlineReasoningTags('A<Think>reasoning</tHiNk>B'),
    ).toBe('AB')
  })

  test('fast path: leaves normal text unchanged', () => {
    expect(stripInlineReasoningTags('Just a normal sentence.')).toBe(
      'Just a normal sentence.',
    )
  })

  test('paired removal happens before unclosed-opener (no over-eating)', () => {
    // A block that actually closes must not be eaten by the unclosed rule.
    expect(
      stripInlineReasoningTags(
        '<think>block one</think>visible<think>unclosed',
      ),
    ).toBe('visible')
  })
})
