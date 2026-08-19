import { useCallback, useState } from "react"
import { addDictionaryWord, removeDictionaryWord } from "../store/dictionary"

interface DictionaryPanelProps {
  words: string[]
  loading: boolean
  onChange: (words: string[]) => void
  /** Framing copy — Settings and Library show the same list with different context. */
  description: string
  addPlaceholder?: string
}

export function DictionaryPanel({
  words,
  loading,
  onChange,
  description,
  addPlaceholder = "Add a word…",
}: DictionaryPanelProps) {
  const [newWord, setNewWord] = useState("")
  const [busy, setBusy] = useState(false)

  const handleAdd = useCallback(async () => {
    if (!newWord.trim()) return
    setBusy(true)
    try {
      const updated = await addDictionaryWord(newWord)
      onChange(updated)
      setNewWord("")
    } finally {
      setBusy(false)
    }
  }, [newWord, onChange])

  const handleRemove = useCallback(
    async (word: string) => {
      setBusy(true)
      try {
        const updated = await removeDictionaryWord(word)
        onChange(updated)
      } finally {
        setBusy(false)
      }
    },
    [onChange],
  )

  return (
    <div className="panel">
      <p className="panel-description">{description}</p>

      <div className="dictionary-form">
        <input
          className="text-input"
          type="text"
          placeholder={addPlaceholder}
          value={newWord}
          onChange={event => setNewWord(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter") void handleAdd()
          }}
        />
        <button className="framer-button-primary" onClick={() => void handleAdd()} disabled={busy || !newWord.trim()}>
          Add
        </button>
      </div>

      {loading && <p className="empty-state">Loading dictionary…</p>}

      {!loading && words.length === 0 && <p className="empty-state">No custom words yet.</p>}

      {!loading && words.length > 0 && (
        <ul className="dictionary-list">
          {words.map(word => (
            <li key={word} className="dictionary-item">
              <span>{word}</span>
              <button className="link-button" disabled={busy} onClick={() => void handleRemove(word)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
