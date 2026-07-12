/**
 * Strip inline tool/function-call markers that MiniMax M3 (and similar
 * models) emit inside the text stream when they fail to use the standard
 * `tool_calls` channel. These are protocol artifacts, not user-facing text.
 *
 * Observed MiniMax M3 inline formats:
 *   - `<]minimax[>`                    — segment delimiter (appears in pairs)
 *   - `<invoke name="bash">...</invoke>` — tool-invocation wrapper
 *   - `<command>...</command>`           — argument sub-tags inside <invoke>
 *   - `<parameter name="x">...</parameter>`
 *   - `<tool_call>...</tool_call>` / orphaned `</tool_call>`
 *   - `(tool call)` / `(tool call [Tool call: name] {...})` prose-style leaks
 *   - `<function_calls>[<invoke name="bash">]...` bracket-style XML leaks
 *   - `[<parameter name="command">...][ ]` bracket parameter leaks
 *
 * We strip the tag-shaped ones (angle-bracket and bracket-delimited) which are
 * unambiguous. The prose-style `(tool call [Tool call: ...] {...})` is harder
 * to match without false positives, so it is handled by a conservative pattern
 * that requires the literal `Tool call:` marker.
 */

/** MiniMax segment delimiter `<]minimax[>` (and its mirror). */
const MINIMAX_DELIMITER_RE = /<\]minimax\[>/g

/** Paired MiniMax tool-invocation wrapper and its argument sub-tags. */
const MINIMAX_INVOKE_TAGS = ['invoke', 'command', 'parameter', 'tool_call', 'function_calls'] as const
const PAIRED_INVOKE_RE = new RegExp(
  `<(?:${MINIMAX_INVOKE_TAGS.join('|')})(?:\\s[^>]*)?>[\\s\\S]*?<\\/(?:${MINIMAX_INVOKE_TAGS.join('|')})>`,
  'gi',
)
const UNCLOSED_INVOKE_RE = new RegExp(
  `<(?:${MINIMAX_INVOKE_TAGS.join('|')})(?:\\s[^>]*)?>[\\s\\S]*`,
  'gi',
)
const ORPHANED_INVOKE_CLOSE_RE = new RegExp(
  `<\\/(?:${MINIMAX_INVOKE_TAGS.join('|')})>`,
  'gi',
)

/**
 * Bracket-style XML tool-call leak (Anthropic/Claude format that MiniMax
 * sometimes emits verbatim):
 *   `<function_calls>[<invoke name="bash">][<parameter name="command">...][ ]`
 *   `(tool call <function_calls>[<invoke ...>][<parameter ...>]...`
 * These appear as bracket-delimited tags without proper angle-bracket pairing.
 */
const BRACKET_FUNCTION_CALLS_RE = /(?:\(tool call\s*)?<function_calls>[\s\S]*?<\/function_calls>(?:\))?/gi
const BRACKET_FUNCTION_CALLS_UNCLOSED_RE = /(?:\(tool call\s*)?<function_calls>[\s\S]*$/gi
const BRACKET_INVOKE_BLOCK_RE = /\[<invoke\s+name="[^"]*">\][\s\S]*?\[<\/invoke>\]/gi
const BRACKET_INVOKE_UNCLOSED_RE = /\[<invoke\s+name="[^"]*">\][\s\S]*$/gi
const BRACKET_PARAMETER_BLOCK_RE = /\[<parameter\s+name="[^"]*">[\s\S]*?\]\s*/gi
const BRACKET_CLOSE_RE = /\[<\/(?:invoke|parameter|function_calls)>\]\s*/gi
const LEAKED_TOOL_CALL_RE = /\(tool call\)\s*/gi

/**
 * Prose-style leak: `(tool call [Tool call: write] {...})`. Requires the
 * literal `Tool call:` discriminator so we don't match arbitrary parenthetical
 * prose. Non-greedy, stops at the matching closing paren on the same logical
 * block.
 */
const PROSE_TOOL_CALL_RE = /\(tool call\s*\[Tool call:[^\]]*\][\s\S]*?\)\s*/gi

/** Fast-path test: any tool-call marker present at all? */
const HAS_MARKER_RE = /<\]minimax\[>|<\/?(?:invoke|command|parameter|tool_call|function_calls)\b|\(tool call|<function_calls>|\[<(?:invoke|parameter|function_calls)/i

/**
 * Remove inline tool/function-call markers and their inner content from `text`.
 *
 * Returns the cleaned text. When every character was a marker (the model only
 * emitted a tool-call block inline), returns an empty string so callers can
 * skip emitting an empty delta.
 */
export function stripInlineToolCallMarkers(text: string): string {
  if (!text) return text
  if (!HAS_MARKER_RE.test(text)) return text
  let out = text.replace(MINIMAX_DELIMITER_RE, '')
  // Angle-bracket paired tags
  out = out.replace(PAIRED_INVOKE_RE, '')
  out = out.replace(UNCLOSED_INVOKE_RE, '')
  out = out.replace(ORPHANED_INVOKE_CLOSE_RE, '')
  // Bracket-style XML tags (function_calls format)
  out = out.replace(BRACKET_FUNCTION_CALLS_RE, '')
  out = out.replace(BRACKET_FUNCTION_CALLS_UNCLOSED_RE, '')
  out = out.replace(BRACKET_INVOKE_BLOCK_RE, '')
  out = out.replace(BRACKET_INVOKE_UNCLOSED_RE, '')
  out = out.replace(BRACKET_PARAMETER_BLOCK_RE, '')
  out = out.replace(BRACKET_CLOSE_RE, '')
  // Prose-style and empty markers
  out = out.replace(PROSE_TOOL_CALL_RE, '')
  out = out.replace(LEAKED_TOOL_CALL_RE, '')
  return out
}
