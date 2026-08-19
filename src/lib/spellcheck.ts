import Typo from "typo-js"

/**
 * Local, fully-offline spellchecking backed by a bundled Hunspell dictionary.
 *
 * The dictionary files are served from this plugin's own `public/` assets
 * (see `public/dictionaries/en_US/`) and fetched once at startup. No text is
 * ever sent to an external service.
 */

let typoInstance: Typo | null = null
let loadPromise: Promise<Typo> | null = null

/**
 * Load (and cache) the Hunspell dictionary. Safe to call multiple times;
 * the underlying fetch + parse only happens once.
 */
export function loadDictionary(): Promise<Typo> {
  if (typoInstance) return Promise.resolve(typoInstance)
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const [affResponse, dicResponse] = await Promise.all([
      fetch("/dictionaries/en_US/en_US.aff"),
      fetch("/dictionaries/en_US/en_US.dic"),
    ])

    if (!affResponse.ok || !dicResponse.ok) {
      throw new Error("Failed to load the bundled spelling dictionary.")
    }

    const [affData, wordsData] = await Promise.all([affResponse.text(), dicResponse.text()])

    typoInstance = new Typo("en_US", affData, wordsData)
    return typoInstance
  })()

  return loadPromise
}

/**
 * Check whether a single word is spelled correctly.
 *
 * Must be called after `loadDictionary()` has resolved.
 */
export function checkWord(word: string): boolean {
  if (!typoInstance) {
    throw new Error("Dictionary not loaded yet. Call loadDictionary() first.")
  }
  return typoInstance.check(word)
}

/**
 * Get spelling suggestions for a misspelled word.
 *
 * Must be called after `loadDictionary()` has resolved.
 */
export function suggest(word: string, limit = 5): string[] {
  if (!typoInstance) {
    throw new Error("Dictionary not loaded yet. Call loadDictionary() first.")
  }
  return typoInstance.suggest(word, limit)
}

export function isDictionaryLoaded(): boolean {
  return typoInstance !== null
}
