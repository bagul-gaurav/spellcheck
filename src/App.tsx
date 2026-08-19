import { framer } from "@framer/plugin"
import { useEffect, useState } from "react"
import "./App.css"
import { SpellcheckPanel } from "./components/SpellcheckPanel"
import { SearchPanel } from "./components/SearchPanel"
import { DictionaryPanel } from "./components/DictionaryPanel"
import { getDictionaryWords } from "./store/dictionary"

framer.showUI({
  position: "top right",
  width: 340,
  height: 560,
  resizable: true,
})

type Tab = "spellcheck" | "search" | "dictionary"

export function App() {
  const [tab, setTab] = useState<Tab>("spellcheck")
  const [dictionaryWords, setDictionaryWords] = useState<string[]>([])
  const [dictionaryLoading, setDictionaryLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getDictionaryWords()
      .then(words => {
        if (!cancelled) setDictionaryWords(words)
      })
      .finally(() => {
        if (!cancelled) setDictionaryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="app">
      <nav className="tabs">
        <button className={tab === "spellcheck" ? "tab active" : "tab"} onClick={() => setTab("spellcheck")}>
          Spellcheck
        </button>
        <button className={tab === "search" ? "tab active" : "tab"} onClick={() => setTab("search")}>
          Search
        </button>
        <button className={tab === "dictionary" ? "tab active" : "tab"} onClick={() => setTab("dictionary")}>
          Dictionary{dictionaryWords.length > 0 ? ` (${dictionaryWords.length})` : ""}
        </button>
      </nav>

      <div className="tab-content">
        {tab === "spellcheck" && <SpellcheckPanel dictionaryWords={dictionaryWords} onDictionaryChange={setDictionaryWords} />}
        {tab === "search" && <SearchPanel />}
        {tab === "dictionary" && (
          <DictionaryPanel words={dictionaryWords} loading={dictionaryLoading} onChange={setDictionaryWords} />
        )}
      </div>
    </main>
  )
}
