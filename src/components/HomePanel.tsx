import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { scanItems, type ScanProgress, type SpellIssue } from "../lib/scan"
import { collectAllTextItems, collectPageTextItems } from "../lib/traverse"
import { replaceWordEverywhere } from "../lib/textReplace"
import { jumpToNode } from "../lib/navigation"
import { useCanvasRoot } from "../lib/useCanvasRoot"
import { isScanCancelled } from "../lib/cancellation"
import { addDictionaryWord, toLookupSet } from "../store/dictionary"
import { ResultsList } from "./ResultsList"

interface HomePanelProps {
  dictionaryWords: string[]
  onDictionaryChange: (words: string[]) => void
  onOpenSearch: () => void
}

/** What a scan covers: the open page/component, or every page and component. */
type ScanScope = "page" | "project"

export function HomePanel({ dictionaryWords, onDictionaryChange, onOpenSearch }: HomePanelProps) {
  const { root, name } = useCanvasRoot()
  const [scope, setScope] = useState<ScanScope>("page")
  const [issues, setIssues] = useState<SpellIssue[]>([])
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  /** Which scope the currently displayed results came from, or null if none. */
  const [scannedScope, setScannedScope] = useState<ScanScope | null>(null)

  /** Controller for the in-flight scan, so Cancel (or unmount) can abort it. */
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const ignoredWords = useMemo(() => toLookupSet(dictionaryWords), [dictionaryWords])

  const runScan = useCallback(async () => {
    const pageRoot = root
    if (scope === "page" && !pageRoot) return

    // Abandon any previous run before starting a new one, so two scans can
    // never both be writing progress/results.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setScanning(true)
    setError(null)
    setProgress(null)
    setScannedScope(null)
    try {
      const items =
        scope === "page" && pageRoot
          ? await collectPageTextItems(pageRoot, { signal: controller.signal })
          : await collectAllTextItems({ signal: controller.signal })

      const found = await scanItems(items, {
        ignoredWords,
        signal: controller.signal,
        onProgress: setProgress,
      })

      setIssues(found)
      setScannedScope(scope)
    } catch (err) {
      // A cancelled scan is a user action, not a failure — leave the panel in
      // its pre-scan state rather than showing an error.
      if (!isScanCancelled(err)) {
        setError(err instanceof Error ? err.message : "Something went wrong while scanning.")
      }
    } finally {
      // Only the newest run owns the UI state; a superseded or cancelled run
      // must not clear the spinner out from under its replacement.
      if (abortRef.current === controller) {
        abortRef.current = null
        setScanning(false)
      }
    }
  }, [root, scope, ignoredWords])

  const cancelScan = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setScanning(false)
    setProgress(null)
  }, [])

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

  const scanLabel = scanning
    ? "Scanning…"
    : scannedScope === scope
      ? scope === "page"
        ? "Rescan This Page"
        : "Rescan Project"
      : scope === "page"
        ? "Scan This Page"
        : "Scan Whole Project"

  return (
    <div className="panel">
      <div className="page-indicator">
        {scope === "page" ? (
          <>
            Scanning <strong>{name}</strong>
          </>
        ) : (
          <>
            Scanning <strong>every page and component</strong>
          </>
        )}
      </div>

      <div className="scope-toggle" role="group" aria-label="Scan scope">
        <button
          className={`scope-option${scope === "page" ? " scope-option-active" : ""}`}
          aria-pressed={scope === "page"}
          disabled={scanning}
          onClick={() => setScope("page")}
        >
          This page
        </button>
        <button
          className={`scope-option${scope === "project" ? " scope-option-active" : ""}`}
          aria-pressed={scope === "project"}
          disabled={scanning}
          onClick={() => setScope("project")}
        >
          Whole project
        </button>
      </div>

      <div className="panel-toolbar">
        <button
          className="framer-button-primary"
          onClick={() => void runScan()}
          disabled={scanning || (scope === "page" && !root)}
        >
          {scanLabel}
        </button>
        {scanning ? (
          <button className="secondary-button" onClick={cancelScan}>
            Cancel
          </button>
        ) : (
          <button className="secondary-button" onClick={onOpenSearch}>
            Search
          </button>
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
            {progress ? `${progress.scanned} / ${progress.total} text layers` : "Collecting text layers…"}
          </span>
        </div>
      )}

      {error && <p className="error-state">{error}</p>}

      {!scanning && scannedScope && (
        <>
          <p className="panel-summary">
            {issues.length} issue{issues.length === 1 ? "" : "s"}{" "}
            {scannedScope === "project" ? "across the project" : "on this page"}
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

      {!scanning && !scannedScope && !error && (
        <p className="empty-state">
          {scope === "page"
            ? "Scan the current page to find spelling issues on it."
            : "Scan every page and component in this project for spelling issues."}
        </p>
      )}
    </div>
  )
}
