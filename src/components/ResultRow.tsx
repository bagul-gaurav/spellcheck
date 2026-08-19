import type { SpellIssue } from "../lib/scan"

interface ResultRowProps {
  issue: SpellIssue
  onJump: (nodeId: string) => void
  onAccept: (issue: SpellIssue, replacement: string) => void
  /** Adds the word to the shared word list (Settings/Library) and dismisses it. */
  onIgnore: (issue: SpellIssue) => void
  busy: boolean
}

export function ResultRow({ issue, onJump, onAccept, onIgnore, busy }: ResultRowProps) {
  return (
    <li className="result-row">
      <button className="result-row-context" onClick={() => onJump(issue.nodeId)} title="Jump to layer">
        <span className="result-row-word">
          {issue.word}
          {issue.occurrences > 1 && <span className="result-row-count">×{issue.occurrences}</span>}
        </span>
        <span className="result-row-snippet">{issue.context}</span>
      </button>

      {issue.suggestions.length > 0 && (
        <div className="result-row-suggestions">
          {issue.suggestions.slice(0, 3).map(suggestion => (
            <button
              key={suggestion}
              className="chip"
              disabled={busy}
              onClick={() => onAccept(issue, suggestion)}
              title={`Replace with "${suggestion}"`}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <div className="result-row-actions">
        <button className="link-button" disabled={busy} onClick={() => onIgnore(issue)} title="Add to word list, always allow">
          Ignore
        </button>
      </div>
    </li>
  )
}
