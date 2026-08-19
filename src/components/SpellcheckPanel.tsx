import { useCallback, useMemo, useState, type CSSProperties } from "react"
import { scanProject, type ScanProgress, type SpellIssue } from "../lib/scan"
import { replaceWordEverywhere } from "../lib/textReplace"
import { jumpToNode } from "../lib/navigation"
import { addDictionaryWord, toLookupSet } from "../store/dictionary"
import { ResultsList } from "./ResultsList"

interface SpellcheckPanelProps {
  dictionaryWords: string[]
  onDictionaryChange: (words: string[]) => void
}

export function SpellcheckPanel({ dictionaryWords, onDictionaryChange }: SpellcheckPanelProps) {
  const [issues, setIssues] = useState<SpellIssue[]>([])
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [hasScanned, setHasScanned] = useState(false)

  const ignoredWords = useMemo(() => toLookupSet(dictionaryWords), [dictionaryWords])

  const runScan = useCallback(async () => {
    setScanning(true)
    setError(null)
    setProgress(null)
    try {
      const found = await scanProject({
        ignoredWords,
        onProgress: setProgress,
      })
      setIssues(found)
      setHasScanned(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong while scanning.")
    } finally {
      setScanning(false)
    }
  }, [ignoredWords])

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

  const handleIgnore = useCallback((issue: SpellIssue) => {
    setIssues(current => current.filter(item => item.id !== issue.id))
  }, [])

  const handleAddToDictionary = useCallback(
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

  const pageCount = useMemo(() => new Set(issues.map(issue => issue.location.split(" > ")[0])).size, [issues])

  return (
    <div className="panel">
      <div className="panel-toolbar">
        <button className="framer-button-primary" onClick={() => void runScan()} disabled={scanning}>
          {scanning ? "Scanning…" : hasScanned ? "Rescan Project" : "Scan Project"}
        </button>
        {hasScanned && !scanning && (
          <span className="panel-summary">
            {issues.length} issue{issues.length === 1 ? "" : "s"} across {pageCount} location{pageCount === 1 ? "" : "s"}
          </span>
        )}
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
        <ResultsList
          issues={issues}
          onJump={handleJump}
          onAccept={(issue, replacement) => void handleAccept(issue, replacement)}
          onIgnore={handleIgnore}
          onAddToDictionary={issue => void handleAddToDictionary(issue)}
          busyId={busyId}
        />
      )}

      {!scanning && !hasScanned && !error && (
        <p className="empty-state">Scan your project to find spelling issues across every page and component.</p>
      )}
    </div>
  )
}
