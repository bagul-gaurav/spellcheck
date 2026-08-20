import { collectComponentControlItemsRaw, collectTextNodeItemsRaw, mapWithConcurrency, resolveLocation } from "./traverse"
import { buildMatchPattern } from "./wordPattern"

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

export interface SearchOutcome {
  results: SearchResult[]
  /** True if more items matched than `MAX_RESULTS` — only the first batch is returned. */
  truncated: boolean
}

/**
 * Hard cap on rendered results. Without this, a broad query (e.g. a single
 * common letter) can match a large fraction of a project's text layers,
 * and rendering that many result rows in the plugin's small panel is what
 * actually locks up the tab — not the search itself.
 */
const MAX_RESULTS = 200

/** Round-trips (location lookups) allowed in flight at once when resolving matched results. */
const LOCATION_CONCURRENCY = 24

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
 *
 * Location breadcrumbs (which require walking each node's ancestors — the
 * expensive part) are only resolved for items that actually match, and only
 * up to `MAX_RESULTS` of them, so a broad query over a large project stays
 * fast and the results list stays bounded.
 */
export async function searchProject(query: string, options: SearchOptions = {}): Promise<SearchOutcome> {
  const trimmed = query.trim()
  if (!trimmed) return { results: [], truncated: false }

  // Built by the same helper the replacer uses, so a result that was found
  // here is always a result "Replace" can actually rewrite.
  const pattern = buildMatchPattern(trimmed, options)

  const [textItems, controlItems] = await Promise.all([collectTextNodeItemsRaw(), collectComponentControlItemsRaw()])
  const allItems = [...textItems, ...controlItems]

  type Match = { item: (typeof allItems)[number]; index: number; length: number; count: number }
  const matches: Match[] = []

  for (const item of allItems) {
    const found = [...item.text.matchAll(pattern)]
    if (found.length === 0) continue
    const first = found[0]
    if (first.index === undefined) continue
    matches.push({ item, index: first.index, length: first[0].length, count: found.length })
    if (matches.length >= MAX_RESULTS) break
  }

  // A query can match far more than MAX_RESULTS across a large project; we
  // stop collecting once the cap is hit, so "truncated" just means we broke
  // out early above rather than exhausted every item.
  const truncated = matches.length >= MAX_RESULTS

  const locations = await mapWithConcurrency(matches, LOCATION_CONCURRENCY, match => resolveLocation(match.item.node))

  const results: SearchResult[] = matches.map((match, i) => ({
    id: match.item.id,
    nodeId: match.item.nodeId,
    kind: match.item.kind,
    controlKey: match.item.controlKey,
    location: match.item.controlKey ? `${locations[i]} (${match.item.controlKey})` : locations[i],
    text: match.item.text,
    matchCount: match.count,
    preview: buildContext(match.item.text, match.index, match.length),
  }))

  return { results, truncated }
}
