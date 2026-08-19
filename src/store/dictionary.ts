import { framer } from "@framer/plugin"

/**
 * A persisted, user-editable list of words that the spellchecker should
 * always treat as correctly spelled (brand names, jargon, etc).
 *
 * Stored as a single JSON-encoded array under the plugin's own project-scoped
 * plugin data (`framer.getPluginData` / `framer.setPluginData`), so it
 * survives across sessions and is shared by everyone who opens the plugin on
 * this project.
 */

const DICTIONARY_PLUGIN_DATA_KEY = "spellcheck.customDictionary"

function normalizeWord(word: string): string {
  return word.trim()
}

async function readRaw(): Promise<string[]> {
  const raw = await framer.getPluginData(DICTIONARY_PLUGIN_DATA_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.filter((word): word is string => typeof word === "string")
    }
    return []
  } catch {
    return []
  }
}

async function writeRaw(words: string[]): Promise<void> {
  await framer.setPluginData(DICTIONARY_PLUGIN_DATA_KEY, JSON.stringify(words))
}

/** Get the full custom dictionary word list, sorted case-insensitively. */
export async function getDictionaryWords(): Promise<string[]> {
  const words = await readRaw()
  return [...words].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
}

/** Add a word to the custom dictionary. No-op if it's already present. */
export async function addDictionaryWord(word: string): Promise<string[]> {
  const normalized = normalizeWord(word)
  if (!normalized) return getDictionaryWords()

  const words = await readRaw()
  const alreadyPresent = words.some(existing => existing.toLowerCase() === normalized.toLowerCase())
  if (!alreadyPresent) {
    words.push(normalized)
    await writeRaw(words)
  }
  return getDictionaryWords()
}

/** Remove a word from the custom dictionary. */
export async function removeDictionaryWord(word: string): Promise<string[]> {
  const words = await readRaw()
  const filtered = words.filter(existing => existing.toLowerCase() !== word.toLowerCase())
  await writeRaw(filtered)
  return getDictionaryWords()
}

/** Build a fast case-insensitive lookup set for use during a scan. */
export function toLookupSet(words: string[]): Set<string> {
  return new Set(words.map(word => word.toLowerCase()))
}
