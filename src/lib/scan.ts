import { collectAllTextItems, type TextItem } from "./traverse"
import { checkWord, loadDictionary, suggest } from "./spellcheck"

export interface SpellIssue {
  id: string
  itemId: string
  nodeId: string
  kind: "text" | "control"
  controlKey?: string
  word: string
  location: string
  context: string
  suggestions: string[]
  occurrences: number
}

export interface ScanProgress {
  scanned: number
  total: number
}

export interface ScanOptions {
  /** Lowercased set of words to never flag. */
  ignoredWords: Set<string>
  onProgress?: (progress: ScanProgress) => void
}

// Unicode-aware "word" — letters and internal apostrophes (don't/don't).
const WORD_PATTERN = /[\p{L}][\p{L}'’]*/gu

function tokenize(text: string): Array<{ word: string; index: number }> {
  const matches: Array<{ word: string; index: number }> = []
  for (const match of text.matchAll(WORD_PATTERN)) {
    if (match.index === undefined) continue
    matches.push({ word: match[0], index: match.index })
  }
  return matches
}

function buildContext(text: string, index: number, wordLength: number): string {
  const radius = 24
  const start = Math.max(0, index - radius)
  const end = Math.min(text.length, index + wordLength + radius)
  const prefix = start > 0 ? "…" : ""
  const suffix = end < text.length ? "…" : ""
  return `${prefix}${text.slice(start, end)}${suffix}`
}

function isCorrectlySpelled(word: string): boolean {
  if (checkWord(word)) return true
  // Avoid flagging every sentence-initial capitalized word when the
  // lowercase form is a real word (e.g. "The" at the start of a sentence).
  const lower = word.toLowerCase()
  if (lower !== word && checkWord(lower)) return true
  return false
}

/**
 * Scan every text item in the project and return one issue per unique
 * misspelled word found in each item (accepting a fix corrects every
 * occurrence of that word within that same text field).
 */
export async function scanProject(options: ScanOptions): Promise<SpellIssue[]> {
  await loadDictionary()

  const items = await collectAllTextItems()
  const issues: SpellIssue[] = []

  let scanned = 0
  for (const item of items) {
    scanned++
    options.onProgress?.({ scanned, total: items.length })

    issues.push(...scanTextItem(item, options.ignoredWords))

    // Yield to the event loop periodically so the UI (progress bar, cancel
    // affordance) stays responsive during a large scan.
    if (scanned % 8 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }

  return issues
}

function scanTextItem(item: TextItem, ignoredWords: Set<string>): SpellIssue[] {
  const seenWords = new Set<string>()
  const issues: SpellIssue[] = []
  const tokens = tokenize(item.text)

  const countByWord = new Map<string, number>()
  for (const { word } of tokens) {
    countByWord.set(word, (countByWord.get(word) ?? 0) + 1)
  }

  for (const { word, index } of tokens) {
    if (seenWords.has(word)) continue
    seenWords.add(word)

    if (word.length < 2) continue
    if (ignoredWords.has(word.toLowerCase())) continue
    if (isCorrectlySpelled(word)) continue

    issues.push({
      id: `${item.id}:${word}`,
      itemId: item.id,
      nodeId: item.nodeId,
      kind: item.kind,
      controlKey: item.controlKey,
      word,
      location: item.location,
      context: buildContext(item.text, index, word.length),
      suggestions: suggest(word),
      occurrences: countByWord.get(word) ?? 1,
    })
  }

  return issues
}
