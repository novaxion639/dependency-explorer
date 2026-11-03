const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000

export function isStaleSnapshot(snapshotDate: string, now: Date): boolean {
  const snapshotMs = Date.parse(snapshotDate)
  return Number.isNaN(snapshotMs) || now.getTime() - snapshotMs > STALE_AFTER_MS
}
