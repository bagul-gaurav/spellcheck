import {
  framer,
  isTextNode,
  type AnyNode,
  type CanvasRootNode,
  type ComponentInstanceNode,
  type TextNode,
} from "@framer/plugin"

/**
 * Anything `getNodesWithType` can be called on: either the top-level
 * `framer` API (project-wide) or a specific node (scoped to its
 * descendants) — both share the same overload signatures.
 */
interface NodeQueryScope {
  getNodesWithType(type: "TextNode"): Promise<TextNode[]>
  getNodesWithType(type: "ComponentInstanceNode"): Promise<ComponentInstanceNode[]>
}

/**
 * A single piece of editable text found somewhere in the project: either a
 * real `TextNode`'s content, or a text-like control value on a component
 * instance (e.g. a code component's string/formatted-text property).
 */
export interface TextItem {
  /** Stable unique key for this item (nodeId, or nodeId+controlKey). */
  id: string
  nodeId: string
  kind: "text" | "control"
  /** Only set when `kind === "control"`. */
  controlKey?: string
  text: string
  /** Human-readable "Page > Frame > Layer" style breadcrumb for display. */
  location: string
}

const MAX_ANCESTOR_WALK = 60

/**
 * Run `fn` over `items` with at most `limit` calls in flight at once.
 * Plain `Promise.all` over thousands of items would fire that many
 * concurrent messages at the Framer host at once; a fully sequential
 * `for` loop is safe but needlessly slow (one network round-trip at a
 * time). This gives bounded concurrency instead.
 */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++
      results[current] = await fn(items[current])
    }
  }

  const workerCount = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

/**
 * Walk a node's ancestors to build a human-readable breadcrumb, e.g.
 * "Home > Header > Title" or "Button (component) > Label".
 *
 * This is relatively expensive (up to `MAX_ANCESTOR_WALK` round-trips per
 * node) — only call it for nodes you actually need a label for, not for
 * every node in a large project.
 */
export async function resolveLocation(node: AnyNode): Promise<string> {
  const parts: string[] = []
  let current: AnyNode | null = node

  // Include the node's own name if it's meaningfully different from "Text"/"Layer" noise.
  for (let i = 0; i < MAX_ANCESTOR_WALK && current; i++) {
    const name = getDisplayName(current)
    if (name) parts.unshift(name)

    if (!("getParent" in current)) break
    try {
      current = await current.getParent()
    } catch {
      break
    }
  }

  return parts.length > 0 ? parts.join(" > ") : "Untitled"
}

export function getDisplayName(node: AnyNode): string | null {
  if ("name" in node && typeof node.name === "string" && node.name.trim()) {
    return node.name
  }
  if ("path" in node && typeof node.path === "string" && node.path.trim()) {
    return node.path === "/" ? "Home" : node.path
  }
  return null
}

/** Number of node-vs-host round-trips allowed in flight at once. */
const FETCH_CONCURRENCY = 24

/**
 * Collect every plain-text `TextNode` within `scope`. Pass `framer` (the
 * default) to search the whole project, or a specific `CanvasRootNode` to
 * scope the search to just that page/component's descendants.
 */
export async function collectTextNodeItems(scope: NodeQueryScope = framer): Promise<TextItem[]> {
  const rawItems = await collectTextNodeItemsRaw(scope)
  const items: TextItem[] = []

  const locations = await mapWithConcurrency(rawItems, FETCH_CONCURRENCY, item => resolveLocation(item.node))
  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i]
    items.push({ id: raw.id, nodeId: raw.nodeId, kind: raw.kind, controlKey: raw.controlKey, text: raw.text, location: locations[i] })
  }

  return items
}

/**
 * Collect text-like control values (string / formattedText controls) on
 * component instances. This covers text embedded in code components that
 * expose their copy as a property control rather than as a real `TextNode`.
 *
 * Relies on the (alpha) `typedControls` getter to know which control keys
 * hold text; instances that don't expose it are skipped rather than guessed
 * at, to avoid mistaking colors/URLs/etc for text.
 *
 * Pass `framer` (the default) to search the whole project, or a specific
 * `CanvasRootNode` to scope the search to just that page/component.
 */
export async function collectComponentControlItems(scope: NodeQueryScope = framer): Promise<TextItem[]> {
  const rawItems = await collectComponentControlItemsRaw(scope)
  const items: TextItem[] = []

  const locations = await mapWithConcurrency(rawItems, FETCH_CONCURRENCY, item => resolveLocation(item.node))
  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i]
    items.push({
      id: raw.id,
      nodeId: raw.nodeId,
      kind: raw.kind,
      controlKey: raw.controlKey,
      text: raw.text,
      location: `${locations[i]} (${raw.controlKey})`,
    })
  }

  return items
}

interface RawTextItem extends Omit<TextItem, "location"> {
  /** Kept so a location breadcrumb can be resolved lazily, only if needed. */
  node: AnyNode
}

/**
 * Same as `collectTextNodeItems`, but skips the expensive per-node ancestor
 * walk that builds the location breadcrumb — every `TextNode`'s `getText()`
 * is still fetched (needed to know if it matches), in parallel with bounded
 * concurrency, but nothing walks up the tree yet. Used by search, where the
 * project can have far more text layers than will ever match a query, and
 * paying `resolveLocation`'s cost for every single one (rather than just
 * the matches) is what causes the whole plugin to stall on a large project.
 */
export async function collectTextNodeItemsRaw(scope: NodeQueryScope = framer): Promise<RawTextItem[]> {
  const textNodes = await scope.getNodesWithType("TextNode")

  const texts = await mapWithConcurrency(textNodes, FETCH_CONCURRENCY, node => node.getText())

  const items: RawTextItem[] = []
  for (let i = 0; i < textNodes.length; i++) {
    const text = texts[i]
    if (!text || !text.trim()) continue
    items.push({ id: textNodes[i].id, nodeId: textNodes[i].id, kind: "text", text, node: textNodes[i] })
  }
  return items
}

/** Raw (no location resolved yet) counterpart to `collectComponentControlItems` — see `collectTextNodeItemsRaw`. */
export async function collectComponentControlItemsRaw(scope: NodeQueryScope = framer): Promise<RawTextItem[]> {
  const instances = await scope.getNodesWithType("ComponentInstanceNode")
  const items: RawTextItem[] = []

  for (const node of instances) {
    const typed = getTypedTextControls(node)
    if (!typed) continue

    for (const [key, value] of typed) {
      if (!value.trim()) continue
      items.push({ id: `${node.id}:${key}`, nodeId: node.id, kind: "control", controlKey: key, text: value, node })
    }
  }

  return items
}

/** Extract `{ key: textValue }` pairs from a component instance's string/formattedText controls. */
function getTypedTextControls(node: ComponentInstanceNode): Array<[string, string]> | null {
  const typedControls = (node as unknown as { typedControls?: Record<string, { type: string; value?: unknown }> })
    .typedControls
  if (!typedControls) return null

  const pairs: Array<[string, string]> = []
  for (const [key, control] of Object.entries(typedControls)) {
    if (!control) continue
    if (control.type !== "string" && control.type !== "formattedText") continue
    if (typeof control.value !== "string") continue
    pairs.push([key, control.value])
  }
  return pairs
}

/** Collect all scannable text in the project: text nodes plus component-instance text controls. */
export async function collectAllTextItems(): Promise<TextItem[]> {
  const [textItems, controlItems] = await Promise.all([collectTextNodeItems(), collectComponentControlItems()])
  return [...textItems, ...controlItems]
}

/**
 * Collect all scannable text within a single page or component — the
 * currently active canvas root — rather than the whole project. Used by the
 * home screen's "Scan This Page" action.
 */
export async function collectPageTextItems(root: CanvasRootNode): Promise<TextItem[]> {
  const [textItems, controlItems] = await Promise.all([
    collectTextNodeItems(root),
    collectComponentControlItems(root),
  ])
  return [...textItems, ...controlItems]
}

export async function getTextNodeById(nodeId: string): Promise<TextNode | null> {
  const node = await framer.getNode(nodeId)
  if (node && isTextNode(node)) return node
  return null
}
