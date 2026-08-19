import { framer, type CanvasRootNode } from "@framer/plugin"
import { useEffect, useState } from "react"
import { getDisplayName } from "./traverse"

export interface CanvasRootState {
  root: CanvasRootNode | null
  /** Human-readable name for the current page/component, or a fallback while loading. */
  name: string
}

/**
 * Track the currently active canvas root (the page or component the user
 * has open), so the home screen can label and scope its "Scan This Page"
 * action to whatever's currently in view.
 */
export function useCanvasRoot(): CanvasRootState {
  const [root, setRoot] = useState<CanvasRootNode | null>(null)

  useEffect(() => {
    let cancelled = false
    framer.getCanvasRoot().then(initial => {
      if (!cancelled) setRoot(initial)
    })

    const unsubscribe = framer.subscribeToCanvasRoot(updated => {
      setRoot(updated)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const name = root ? (getDisplayName(root) ?? "Untitled") : "Loading…"

  return { root, name }
}
