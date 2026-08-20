/**
 * Cooperative cancellation for the long-running scan pipeline (collecting text
 * layers, then spellchecking them). Both phases are made of many small awaits,
 * so they can check an `AbortSignal` between steps and bail out early.
 */

/** Thrown when an in-flight scan is aborted by the user. */
export class ScanCancelledError extends Error {
  constructor() {
    super("Scan cancelled.")
    this.name = "ScanCancelledError"
  }
}

/** True if `error` is the sentinel thrown by an aborted scan (not a real failure). */
export function isScanCancelled(error: unknown): boolean {
  return error instanceof ScanCancelledError
}

/** Throw `ScanCancelledError` if `signal` has been aborted. */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ScanCancelledError()
}
