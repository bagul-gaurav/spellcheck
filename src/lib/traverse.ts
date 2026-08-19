import { framer, isTextNode, type AnyNode, type ComponentInstanceNode, type TextNode } from "@framer/plugin"

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
 * Walk a node's ancestors to build a human-readable breadcrumb, e.g.
 * "Home > Header > Title" or "Button (component) > Label".
 */
async function resolveLocation(node: AnyNode): Promise<string> {
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

function getDisplayName(node: AnyNode): string | null {
  if ("name" in node && typeof node.name === "string" && node.name.trim()) {
    return node.name
  }
  if ("path" in node && typeof node.path === "string" && node.path.trim()) {
    return node.path === "/" ? "Home" : node.path
  }
  return null
}

/**
 * Collect every plain-text `TextNode` in the project (across all pages and
 * component definitions — `framer.getNodesWithType` queries the whole
 * project, not just the active page).
 */
export async function collectTextNodeItems(): Promise<TextItem[]> {
  const textNodes = await framer.getNodesWithType("TextNode")
  const items: TextItem[] = []

  for (const node of textNodes) {
    const text = await node.getText()
    if (!text || !text.trim()) continue

    const location = await resolveLocation(node)
    items.push({
      id: node.id,
      nodeId: node.id,
      kind: "text",
      text,
      location,
    })
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
 */
export async function collectComponentControlItems(): Promise<TextItem[]> {
  const instances = await framer.getNodesWithType("ComponentInstanceNode")
  const items: TextItem[] = []

  for (const node of instances) {
    const typed = getTypedTextControls(node)
    if (!typed) continue

    const location = await resolveLocation(node)

    for (const [key, value] of typed) {
      if (!value.trim()) continue
      items.push({
        id: `${node.id}:${key}`,
        nodeId: node.id,
        kind: "control",
        controlKey: key,
        text: value,
        location: `${location} (${key})`,
      })
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

export async function getTextNodeById(nodeId: string): Promise<TextNode | null> {
  const node = await framer.getNode(nodeId)
  if (node && isTextNode(node)) return node
  return null
}
