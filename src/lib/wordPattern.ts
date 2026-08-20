/**
 * Shared definition of what counts as a "word", used by both the scanner
 * (tokenizing text to look for misspellings) and the replacer (finding that
 * same word again in the live text in order to fix it).
 *
 * These two MUST agree. If the scanner flags a token the replacer can't match,
 * clicking a suggestion silently does nothing.
 */

/**
 * A single word character: letters plus apostrophes (straight and curly), so
 * `don't` / `don’t` is one word rather than three.
 */
export const WORD_CHAR_CLASS = "[\\p{L}'’]"

/** Escape a string for safe use as a literal inside a `RegExp`. */
export function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** A fresh tokenizer pattern: a letter followed by any run of word characters. */
export function createTokenPattern(): RegExp {
  return new RegExp(`\\p{L}${WORD_CHAR_CLASS}*`, "gu")
}

export interface MatchPatternOptions {
  /** Defaults to `false` (case-insensitive), matching the Search panel's default. */
  caseSensitive?: boolean
  wholeWord?: boolean
}

/**
 * Build a global pattern that finds `needle` in a body of text.
 *
 * With `wholeWord`, the boundaries are lookarounds over `WORD_CHAR_CLASS`
 * rather than `\b`. `\b` is defined against JavaScript's legacy `\w` — ASCII
 * letters, digits and underscore — which treats an apostrophe as a word
 * boundary. That means `\bdon't\b` can never match the text `don't`: the
 * trailing `\b` sits between `'` and `t`, both sides of which are... not a
 * boundary at all. Any fix for an apostrophized word was therefore a silent
 * no-op. Lookarounds over the scanner's own character class fix that, and
 * make the boundaries Unicode-aware while we're here (`\b` would happily
 * match inside `café`).
 */
export function buildMatchPattern(needle: string, options: MatchPatternOptions = {}): RegExp {
  const escaped = escapeRegExp(needle)
  const source = options.wholeWord
    ? `(?<!${WORD_CHAR_CLASS})${escaped}(?!${WORD_CHAR_CLASS})`
    : escaped
  return new RegExp(source, options.caseSensitive ? "gu" : "gui")
}
