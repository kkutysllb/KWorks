import { describe, expect, test } from 'vitest'

import { stripInlineToolCallMarkers } from './tool-call-markers.js'

describe('stripInlineToolCallMarkers', () => {
  test('strips MiniMax <]minimax[> delimiters', () => {
    expect(
      stripInlineToolCallMarkers('Hello<]minimax[>World'),
    ).toBe('HelloWorld')
  })

  test('strips paired <invoke> wrapper with attributes', () => {
    expect(
      stripInlineToolCallMarkers(
        'before<invoke name="bash">run me</invoke>after',
      ),
    ).toBe('beforeafter')
  })

  test('strips <command> argument sub-tag', () => {
    expect(
      stripInlineToolCallMarkers('a<command>ls -la</command>b'),
    ).toBe('ab')
  })

  test('strips <parameter> sub-tag with name attribute', () => {
    expect(
      stripInlineToolCallMarkers('x<parameter name="path">/tmp</parameter>y'),
    ).toBe('xy')
  })

  test('strips paired <tool_call> block', () => {
    expect(
      stripInlineToolCallMarkers('pre<tool_call>{...}</tool_call>post'),
    ).toBe('prepost')
  })

  test('strips unclosed <invoke> opener to end of text', () => {
    expect(
      stripInlineToolCallMarkers('Go<invoke name="bash">never closes'),
    ).toBe('Go')
  })

  test('strips orphaned </tool_call> closer', () => {
    expect(stripInlineToolCallMarkers('text</tool_call>tail')).toBe('texttail')
  })

  test('strips the leaked MiniMax tool-call sequence from the user report', () => {
    const leaked =
      '(tool call)]<]minimax[>[<invoke name="bash">]<]minimax[>[<command>find /tmp -name x</command>]<]minimax[>[</invoke> ]<]minimax[></tool_call>'
    const result = stripInlineToolCallMarkers(leaked)
    // No MiniMax markers should remain.
    expect(result).not.toContain('<]minimax[>')
    expect(result).not.toContain('<invoke')
    expect(result).not.toContain('<command>')
    expect(result).not.toContain('</tool_call>')
  })

  test('strips prose-style (tool call [Tool call: write] {...}) leak', () => {
    expect(
      stripInlineToolCallMarkers(
        '(tool call [Tool call: write] {"path":"/tmp/x","content":"hi"})',
      ),
    ).toBe('')
  })

  test('leaves normal text with parentheses untouched', () => {
    expect(stripInlineToolCallMarkers('(see docs for details)')).toBe(
      '(see docs for details)',
    )
  })

  test('leaves normal prose mentioning "tool call" in a sentence', () => {
    expect(stripInlineToolCallMarkers('The tool call returned 42')).toBe(
      'The tool call returned 42',
    )
  })

  test('returns empty string when only markers present', () => {
    expect(stripInlineToolCallMarkers('<tool_call></tool_call>')).toBe('')
  })

  test('fast path: leaves normal text unchanged', () => {
    expect(stripInlineToolCallMarkers('Just a normal sentence.')).toBe(
      'Just a normal sentence.',
    )
  })
})
