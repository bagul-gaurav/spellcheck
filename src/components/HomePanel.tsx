import { useCallback, useMemo, useState, type CSSProperties } from "react"
import { scanItems, type ScanProgress, type SpellIssue } from "../lib/scan"
import { collectPageTextItems } from "../lib/traverse"
import { replaceWordEverywhere } from "../lib/textReplace"
import { jumpToNode } from "../lib/navigation"
import { useCanvasRoot } from "../lib/useCanvasRoot"
import { addDictionaryWord, toLookupSet } from "../store/dictionary"
import { ResultsList } from "./ResultsList"

interface HomePanelProps {
  dictionaryWords: string[]
  onDictionaryChange: (words: string[]) => void
  onOpenSearch: () => void
}

export function HomePanel({ dictionaryWords, onDictionaryChange, onOpenSearch }: HomePanelProps) {
  const { root, name } = useCanvasRoot()
  const [issues, setIssues] = useState<SpellIssue[]>([])
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [hasScanned, setHasScanned] = useState(false)

  const ignoredWords = useMemo(() => toLookupSet(dictionaryWords), [dictionaryWords])

  const runScan = useCallback(async () => {
    if (!root) return
    setScanning(true)
    setError(null)
    setProgress(null)
    setHasScanned(false)
    try {
      const items = await collectPageTextItems(root)
      const found = await scanItems(items, { ignoredWords, onProgress: setProgress })
      setIssues(found)
      setHasScanned(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong while scanning.")
    } finally {
      setScanning(false)
    }
  }, [root, ignoredWords])

  const handleJump = useCallback((nodeId: string) => {
    void jumpToNode(nodeId)
  }, [])

  const handleAccept = useCallback(async (issue: SpellIssue, replacement: string) => {
    setBusyId(issue.id)
    try {
      const applied = await replaceWordEverywhere(
        { nodeId: issue.nodeId, kind: issue.kind, controlKey: issue.controlKey },
        issue.word,
        replacement,
      )
      if (applied) {
        setIssues(current => current.filter(item => item.id !== issue.id))
      }
    } finally {
      setBusyId(null)
    }
  }, [])

  const handleIgnore = useCallback(
    async (issue: SpellIssue) => {
      setBusyId(issue.id)
      try {
        const updated = await addDictionaryWord(issue.word)
        onDictionaryChange(updated)
        setIssues(current => current.filter(item => item.word.toLowerCase() !== issue.word.toLowerCase()))
      } finally {
        setBusyId(null)
      }
    },
    [onDictionaryChange],
  )

  return (
    <div className="panel">
      <div className="page-indicator">
        Scanning <strong>{name}</strong>
      </div>

      <div className="panel-toolbar">
        <button className="framer-button-primary" onClick={() => void runScan()} disabled={scanning || !root}>
          {scanning ? "Scanning…" : hasScanned ? "Rescan This Page" : "Scan This Page"}
        </button>
        <button className="secondary-button" onClick={onOpenSearch}>
          Search
        </button>
      </div>

      {scanning && (
        <div className="progress">
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ "--progress": progress && progress.total > 0 ? progress.scanned / progress.total : 0 } as CSSProperties}
            />
          </div>
          <span className="progress-label">
            {progress ? `${progress.scanned} / ${progress.total} text layers` : "Loading dictionary…"}
          </span>
        </div>
      )}

      {error && <p className="error-state">{error}</p>}

      {!scanning && hasScanned && (
        <>
          <p className="panel-summary">
            {issues.length} issue{issues.length === 1 ? "" : "s"} on this page
          </p>
          <ResultsList
            issues={issues}
            onJump={handleJump}
            onAccept={(issue, replacement) => void handleAccept(issue, replacement)}
            onIgnore={issue => void handleIgnore(issue)}
            busyId={busyId}
          />
        </>
      )}

      {!scanning && !hasScanned && !error && (
        <p className="empty-state">Scan the current page to find spelling issues on it.</p>
      )}
    </div>
  )
}
