import { collectAllTextItems } from "./traverse"

export interface SearchOptions {
  caseSensitive?: boolean
  wholeWord?: boolean
}

export interface SearchResult {
  id: string
  nodeId: string
  kind: "text" | "control"
  controlKey?: string
  location: string
  text: string
  matchCount: number
  preview: string
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function buildContext(text: string, index: number, matchLength: number): string {
  const radius = 24
  const start = Math.max(0, index - radius)
  const end = Math.min(text.length, index + matchLength + radius)
  const prefix = start > 0 ? "…" : ""
  const suffix = end < text.length ? "…" : ""
  return `${prefix}${text.slice(start, end)}${suffix}`
}

/**
 * Search every text item in the project (pages and component instances) for
 * `query`, returning one result per item that contains at least one match.
 */
export async function searchProject(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const items = await collectAllTextItems()
  const escaped = escapeRegExp(trimmed)
  const source = options.wholeWord ? `\\b${escaped}\\b` : escaped
  const pattern = new RegExp(source, options.caseSensitive ? "g" : "gi")

  const results: SearchResult[] = []

  for (const item of items) {
    const matches = [...item.text.matchAll(pattern)]
    if (matches.length === 0) continue

    const first = matches[0]
    if (first.index === undefined) continue

    results.push({
      id: item.id,
      nodeId: item.nodeId,
      kind: item.kind,
      controlKey: item.controlKey,
      location: item.location,
      text: item.text,
      matchCount: matches.length,
      preview: buildContext(item.text, first.index, first[0].length),
    })
  }

  return results
}
