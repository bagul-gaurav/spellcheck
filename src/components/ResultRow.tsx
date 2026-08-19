import type { SpellIssue } from "../lib/scan"

interface ResultRowProps {
  issue: SpellIssue
  onJump: (nodeId: string) => void
  onAccept: (issue: SpellIssue, replacement: string) => void
  onIgnore: (issue: SpellIssue) => void
  onAddToDictionary: (issue: SpellIssue) => void
  busy: boolean
}

export function ResultRow({ issue, onJump, onAccept, onIgnore, onAddToDictionary, busy }: ResultRowProps) {
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
        <button className="link-button" disabled={busy} onClick={() => onIgnore(issue)}>
          Ignore
        </button>
        <button className="link-button" disabled={busy} onClick={() => onAddToDictionary(issue)}>
          Add to Dictionary
        </button>
      </div>
    </li>
  )
}
