import type { ConnectivityMap, MonolithRoute, ServiceFlow } from '@dependency-explorer/data'

/**
 * Reverse code→flows index: source file → the flows whose code layer traverses
 * it, plus the monolith routes it serves. Keyed "<service>/<path>".
 */
export interface FileIndexEntry {
  service: string
  path: string
  flows: ServiceFlow[]
  labels: string[]
  routes: string[]
}

export function buildFileIndex(map: ConnectivityMap, routes: MonolithRoute[] = []): Map<string, FileIndexEntry> {
  const index = new Map<string, FileIndexEntry>()
  const entryFor = (service: string, filePath: string): FileIndexEntry => {
    const key = `${service}/${filePath}`
    const existing = index.get(key)
    if (existing) {
      return existing
    }
    const created: FileIndexEntry = { service, path: filePath, flows: [], labels: [], routes: [] }
    index.set(key, created)
    return created
  }
  for (const flow of map.flows) {
    for (const unit of flow.codeUnits ?? []) {
      if (!unit.path) {
        continue
      }
      const entry = entryFor(unit.service, unit.path)
      if (!entry.flows.some(f => f.id === flow.id)) {
        entry.flows.push(flow)
      }
      if (!entry.labels.includes(unit.label)) {
        entry.labels.push(unit.label)
      }
    }
  }
  for (const r of routes) {
    entryFor('skello-app', r.controllerFile).routes.push(`${r.verb} ${r.path}`)
  }
  return index
}
