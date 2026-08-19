import { framer } from "@framer/plugin"
import { useEffect, useState } from "react"
import "./App.css"
import { HomePanel } from "./components/HomePanel"
import { SearchPanel } from "./components/SearchPanel"
import { DictionaryPanel } from "./components/DictionaryPanel"
import { TopBar } from "./components/TopBar"
import { getDictionaryWords } from "./store/dictionary"

framer.showUI({
  position: "top right",
  width: 340,
  height: 520,
  resizable: true,
})

type Screen = "home" | "settings" | "library" | "search"

export function App() {
  const [screen, setScreen] = useState<Screen>("home")
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

  const goHome = () => setScreen("home")

  return (
    <main className="app">
      {screen === "home" && (
        <TopBar title="Spellcheck" onOpenSettings={() => setScreen("settings")} onOpenLibrary={() => setScreen("library")} />
      )}
      {screen === "search" && <TopBar title="Search" onBack={goHome} />}
      {screen === "settings" && <TopBar title="Settings" onBack={goHome} />}
      {screen === "library" && <TopBar title="Word library" onBack={goHome} />}

      <div className="screen-content">
        {screen === "home" && (
          <HomePanel
            dictionaryWords={dictionaryWords}
            onDictionaryChange={setDictionaryWords}
            onOpenSearch={() => setScreen("search")}
          />
        )}

        {screen === "search" && <SearchPanel />}

        {screen === "settings" && (
          <DictionaryPanel
            words={dictionaryWords}
            loading={dictionaryLoading}
            onChange={setDictionaryWords}
            description="Words you've ignored during a scan land here. Remove one to have it flagged again."
            addPlaceholder="Add a word to ignore…"
          />
        )}

        {screen === "library" && (
          <DictionaryPanel
            words={dictionaryWords}
            loading={dictionaryLoading}
            onChange={setDictionaryWords}
            description="Words here are always treated as correctly spelled — use it for product names, brand terms, or jargon."
            addPlaceholder="Add a word…"
          />
        )}
      </div>
    </main>
  )
}
