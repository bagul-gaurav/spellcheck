import { useMemo } from "react"
import type { SpellIssue } from "../lib/scan"
import { ResultRow } from "./ResultRow"

interface ResultsListProps {
  issues: SpellIssue[]
  onJump: (nodeId: string) => void
  onAccept: (issue: SpellIssue, replacement: string) => void
  onIgnore: (issue: SpellIssue) => void
  busyId: string | null
}

interface Group {
  location: string
  issues: SpellIssue[]
}

export function ResultsList({ issues, onJump, onAccept, onIgnore, busyId }: ResultsListProps) {
  const groups = useMemo(() => {
    const byLocation = new Map<string, SpellIssue[]>()
    for (const issue of issues) {
      const list = byLocation.get(issue.location) ?? []
      list.push(issue)
      byLocation.set(issue.location, list)
    }
    const result: Group[] = []
    for (const [location, groupIssues] of byLocation) {
      result.push({ location, issues: groupIssues })
    }
    return result
  }, [issues])

  if (issues.length === 0) {
    return <p className="empty-state">No spelling issues found. 🎉</p>
  }

  return (
    <div className="results-list">
      {groups.map(group => (
        <section key={group.location} className="result-group">
          <h3 className="result-group-title">{group.location}</h3>
          <ul className="result-group-items">
            {group.issues.map(issue => (
              <ResultRow
                key={issue.id}
                issue={issue}
                onJump={onJump}
                onAccept={onAccept}
                onIgnore={onIgnore}
                busy={busyId === issue.id}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
