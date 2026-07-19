import type { ConnectivityMap, ServiceFlow } from '@dependency-explorer/data'

/**
 * Reverse code→flows index: source file → the flows whose code layer
 * traverses it. Purely DERIVED from codeUnits[].path (237/239 units carry
 * one) — zero new authored data. Keyed "<service>/<path>" since unit paths
 * are repo-relative.
 */
export interface FileIndexEntry {
  service: string
  path: string
  flows: ServiceFlow[]
  /** unit labels inside this file, for the landing view */
  labels: string[]
}

export function buildFileIndex(map: ConnectivityMap): Map<string, FileIndexEntry> {
  const index = new Map<string, FileIndexEntry>()
  for (const flow of map.flows) {
    for (const unit of flow.codeUnits ?? []) {
      if (!unit.path) continue
      const key = `${unit.service}/${unit.path}`
      const entry = index.get(key)
      if (entry) {
        if (!entry.flows.some(f => f.id === flow.id)) entry.flows.push(flow)
        if (!entry.labels.includes(unit.label)) entry.labels.push(unit.label)
      } else {
        index.set(key, { service: unit.service, path: unit.path, flows: [flow], labels: [unit.label] })
      }
    }
  }
  return index
}
