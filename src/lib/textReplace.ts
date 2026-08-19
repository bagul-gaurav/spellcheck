import { framer, isComponentInstanceNode } from "@framer/plugin"
import { getTextNodeById } from "./traverse"

export interface ReplaceTarget {
  nodeId: string
  kind: "text" | "control"
  controlKey?: string
}

/** Escape a string for safe use inside a `RegExp`. */
function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Match the capitalization pattern of `sample` onto `word` (best-effort). */
function matchCase(word: string, sample: string): string {
  if (sample === sample.toUpperCase() && sample !== sample.toLowerCase()) {
    return word.toUpperCase()
  }
  if (sample[0] === sample[0]?.toUpperCase() && sample.slice(1) === sample.slice(1).toLowerCase()) {
    return word.charAt(0).toUpperCase() + word.slice(1)
  }
  return word
}

async function readCurrentText(target: ReplaceTarget): Promise<string | null> {
  if (target.kind === "text") {
    const node = await getTextNodeById(target.nodeId)
    return node ? await node.getText() : null
  }

  const node = await framer.getNode(target.nodeId)
  if (!node || !isComponentInstanceNode(node) || !target.controlKey) return null
  const controls = node.controls as Record<string, unknown> | undefined
  const value = controls?.[target.controlKey]
  return typeof value === "string" ? value : null
}

async function writeText(target: ReplaceTarget, newText: string): Promise<boolean> {
  if (target.kind === "text") {
    const node = await getTextNodeById(target.nodeId)
    if (!node) return false
    await node.setText(newText)
    return true
  }

  const node = await framer.getNode(target.nodeId)
  if (!node || !isComponentInstanceNode(node) || !target.controlKey) return false
  await node.setAttributes({ controls: { [target.controlKey]: newText } })
  return true
}

/**
 * Replace every whole-word, case-insensitive occurrence of `word` in the
 * target's current text with `replacement`, preserving each occurrence's
 * capitalization pattern. Re-reads the live text immediately before writing,
 * so it stays correct even if the scan is stale.
 *
 * @returns `false` if the node/control could no longer be found, or the word
 * is no longer present in the live text (nothing to do).
 */
export async function replaceWordEverywhere(target: ReplaceTarget, word: string, replacement: string): Promise<boolean> {
  const currentText = await readCurrentText(target)
  if (currentText === null) return false

  const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, "g")
  let matched = false
  const newText = currentText.replace(pattern, match => {
    matched = true
    return matchCase(replacement, match)
  })

  if (!matched) return false
  return writeText(target, newText)
}

/**
 * Replace every occurrence of `query` in the target's current text with
 * `replacement`. Used by the Search & Replace tool for arbitrary text, not
 * just single words.
 */
export async function replaceAllOccurrences(
  target: ReplaceTarget,
  query: string,
  replacement: string,
  options: { caseSensitive?: boolean; wholeWord?: boolean } = {},
): Promise<boolean> {
  const currentText = await readCurrentText(target)
  if (currentText === null || !query) return false

  const escaped = escapeRegExp(query)
  const pattern = new RegExp(options.wholeWord ? `\\b${escaped}\\b` : escaped, options.caseSensitive ? "g" : "gi")

  if (!pattern.test(currentText)) return false
  pattern.lastIndex = 0

  const newText = currentText.replace(pattern, replacement)
  return writeText(target, newText)
}

export async function getLiveText(target: ReplaceTarget): Promise<string | null> {
  return readCurrentText(target)
}
