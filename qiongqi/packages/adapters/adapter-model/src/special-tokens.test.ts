import { describe, expect, test } from 'vitest'

import { stripSpecialTokens } from './special-tokens.js'

describe('stripSpecialTokens', () => {
  test('strips a leading BOS token', () => {
    expect(stripSpecialTokens('<|begin_of_sentence|>Hello there')).toBe(
      'Hello there',
    )
  })

  test('strips tokens appearing mid-text', () => {
    expect(
      stripSpecialTokens('Hello<|user|> world <|assistant|>!'),
    ).toBe('Hello world !')
  })

  test('strips end-of-text tokens', () => {
    expect(stripSpecialTokens('Done.<|endoftext|>')).toBe('Done.')
  })

  test('returns empty string when only tokens were present', () => {
    expect(stripSpecialTokens('<|begin_of_sentence|>')).toBe('')
  })

  test('does not touch plain angle-bracket text (no pipe delimiters)', () => {
    expect(stripSpecialTokens('<div>hello</div>')).toBe('<div>hello</div>')
    expect(stripSpecialTokens('a < b && b > c')).toBe('a < b && b > c')
  })

  test('does not touch code that looks like tags', () => {
    expect(stripSpecialTokens('const x = a < b')).toBe('const x = a < b')
  })

  test('leaves normal text unchanged (fast path)', () => {
    expect(stripSpecialTokens('Just a normal sentence.')).toBe(
      'Just a normal sentence.',
    )
  })

  test('handles empty input', () => {
    expect(stripSpecialTokens('')).toBe('')
  })

  test('strips multiple consecutive tokens leaving their surrounding spaces', () => {
    expect(
      stripSpecialTokens('<|begin_of_sentence|><|user|> hi'),
    ).toBe(' hi')
  })

  test('does not span newlines inside a token', () => {
    // A token with a newline is not a real special token — leave it.
    expect(stripSpecialTokens('<|foo\nbar|>x')).toBe('<|foo\nbar|>x')
  })

  test('strips the [gMASK] bracket marker', () => {
    expect(stripSpecialTokens('[gMASK]Hello')).toBe('Hello')
    expect(stripSpecialTokens('[gMASK]<|begin_of_sentence|>Hi')).toBe('Hi')
  })

  test('strips the [MASK] bracket marker', () => {
    expect(stripSpecialTokens('[MASK]foo')).toBe('foo')
  })

  test('does not strip arbitrary square-bracket prose', () => {
    expect(stripSpecialTokens('[note: see docs]')).toBe('[note: see docs]')
    expect(stripSpecialTokens('array[0] = 1')).toBe('array[0] = 1')
  })
})
