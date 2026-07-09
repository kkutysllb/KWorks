/**
 * Strip inline reasoning/thinking tags that some models emit inside their text
 * stream (instead of through a dedicated `reasoning_content` channel).
 *
 * Models reached via raw OpenAI-compat endpoints (vLLM, llama.cpp, OpenRouter,
 * some GLM/DeepSeek proxies) can inline reasoning as tags like:
 *   - DeepSeek-R1:        `<think>...</think>`
 *   - Some fine-tunes:    `<thinking>...</thinking>`, `<reflection>...</reflection>`
 *
 * The content between the tags IS the reasoning; we drop it entirely here
 * (the engine's reasoning channel is populated separately via
 * `reasoning_content`/`thinking_delta`). What matters at this layer is that
 * neither the tags nor their inner text leak into the assistant's visible
 * message body.
 *
 * Handles the full lifecycle robustly:
 *   1. Paired tags:        `<think>...</think>`           → removed (inner dropped)
 *   2. Unclosed opener:    `<think>reasoning still going` → removed to end of text
 *                          (streaming mid-block, or model forgot to close)
 *   3. Orphaned closer:    `actual answer</think>`        → the `</think>` removed
 *                          (opener was in an earlier chunk)
 *   4. Variant tag names:  `<thinking>`, `<reasoning>`, `<reflection>`
 *
 * Order matters: paired removal first, then unclosed-openers (greedy to EOF),
 * then orphaned closers. This avoids the unclosed-opener rule eating a block
 * that actually closes later in the same text.
 */

/** Reasoning tag names known to be emitted inline by various models. */
const REASONING_TAG_NAMES = ['think', 'thinking', 'reasoning', 'reflection'] as const

/** Matches a paired `<tag>...</tag>` block for any reasoning tag name. */
const PAIRED_RE = new RegExp(
  `<(?:${REASONING_TAG_NAMES.join('|')})>[\\s\\S]*?<\\/(?:${REASONING_TAG_NAMES.join('|')})>`,
  'gi',
)

/**
 * Matches an unclosed opener: `<tag>` with no matching closer anywhere to its
 * right in the text. Applied AFTER paired removal, so any remaining `<tag>`
 * opener means the closer never arrived. Everything from the opener to the end
 * of the text is reasoning and is dropped.
 */
const UNCLOSED_OPENER_RE = new RegExp(
  `<(?:${REASONING_TAG_NAMES.join('|')})>[\\s\\S]*`,
  'gi',
)

/** Matches an orphaned closing tag `</tag>` with no preceding opener. */
const ORPHANED_CLOSER_RE = new RegExp(
  `<\\/(?:${REASONING_TAG_NAMES.join('|')})>`,
  'gi',
)

/**
 * Remove inline reasoning tags and their inner content from `text`.
 *
 * Returns the cleaned text. When every character is reasoning (the model only
 * emitted a think block), returns an empty string so callers can skip emitting
 * an empty delta.
 */
export function stripInlineReasoningTags(text: string): string {
  if (!text) return text
  // Fast path: no reasoning tags present.
  if (!/<\/?(?:think|thinking|reasoning|reflection)>/i.test(text)) return text
  let out = text.replace(PAIRED_RE, '')
  out = out.replace(UNCLOSED_OPENER_RE, '')
  out = out.replace(ORPHANED_CLOSER_RE, '')
  return out
}
