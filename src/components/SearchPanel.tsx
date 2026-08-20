import { useCallback, useState } from "react"
import { searchProject, type SearchResult } from "../lib/search"
import { replaceAllOccurrences } from "../lib/textReplace"
import { jumpToNode } from "../lib/navigation"

export function SearchPanel() {
  const [query, setQuery] = useState("")
  const [replacement, setReplacement] = useState("")
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [truncated, setTruncated] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runSearch = useCallback(async () => {
    setSearching(true)
    setError(null)
    try {
      const outcome = await searchProject(query, { caseSensitive, wholeWord })
      setResults(outcome.results)
      setTruncated(outcome.truncated)
      setSearched(true)
    } catch (err) {
      // Without this the failure surfaced only as an unhandled rejection in
      // the console: the panel just sat there looking like an empty result.
      setResults([])
      setTruncated(false)
      setSearched(false)
      setError(err instanceof Error ? err.message : "Something went wrong while searching.")
    } finally {
      setSearching(false)
    }
  }, [query, caseSensitive, wholeWord])

  const handleReplace = useCallback(
    async (result: SearchResult) => {
      if (!replacement && replacement !== "") return
      setBusyId(result.id)
      try {
        const applied = await replaceAllOccurrences(
          { nodeId: result.nodeId, kind: result.kind, controlKey: result.controlKey },
          query,
          replacement,
          { caseSensitive, wholeWord },
        )
        if (applied) {
          setResults(current => current.filter(item => item.id !== result.id))
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong while replacing.")
      } finally {
        setBusyId(null)
      }
    },
    [query, replacement, caseSensitive, wholeWord],
  )

  const handleReplaceAll = useCallback(async () => {
    for (const result of results) {
      await handleReplace(result)
    }
  }, [results, handleReplace])

  return (
    <div className="panel">
      <div className="search-form">
        <input
          className="text-input"
          type="text"
          placeholder="Search for text…"
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
        <input
          className="text-input"
          type="text"
          placeholder="Replace with… (optional)"
          value={replacement}
          onChange={event => setReplacement(event.target.value)}
        />

        <div className="search-options">
          <label className="checkbox-label">
            <input type="checkbox" checked={caseSensitive} onChange={event => setCaseSensitive(event.target.checked)} />
            Case sensitive
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={wholeWord} onChange={event => setWholeWord(event.target.checked)} />
            Whole word
          </label>
        </div>

        <div className="panel-toolbar">
          <button className="framer-button-primary" onClick={() => void runSearch()} disabled={searching || !query.trim()}>
            {searching ? "Searching…" : "Search"}
          </button>
          {results.length > 0 && (
            <button className="secondary-button" onClick={() => void handleReplaceAll()} disabled={busyId !== null}>
              Replace All ({results.length})
            </button>
          )}
        </div>
      </div>

      {error && <p className="error-state">{error}</p>}

      {searched && results.length === 0 && <p className="empty-state">No matches found.</p>}

      {truncated && (
        <p className="panel-summary">
          Showing the first {results.length} matches — narrow your search to see the rest.
        </p>
      )}

      {results.length > 0 && (
        <ul className="results-list search-results">
          {results.map(result => (
            <li key={result.id} className="result-row">
              <button className="result-row-context" onClick={() => void jumpToNode(result.nodeId)} title="Jump to layer">
                <span className="result-row-word">
                  {result.location}
                  <span className="result-row-count">×{result.matchCount}</span>
                </span>
                <span className="result-row-snippet">{result.preview}</span>
              </button>
              <div className="result-row-actions">
                <button className="link-button" disabled={busyId === result.id} onClick={() => void handleReplace(result)}>
                  Replace
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
