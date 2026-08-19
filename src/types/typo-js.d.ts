declare module "typo-js" {
  export default class Typo {
    constructor(
      dictionary?: string,
      affData?: string,
      wordsData?: string,
      settings?: {
        dictionaryPath?: string
        flags?: Record<string, string>
        asyncLoad?: boolean
        loadedCallback?: (typo: Typo) => void
      },
    )
    check(word: string): boolean
    suggest(word: string, limit?: number): string[]
    loaded: boolean
  }
}
