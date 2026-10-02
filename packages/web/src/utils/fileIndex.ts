import type { ConnectivityMap, MonolithRoute, ResourceRelation, ServiceFlow } from '@dependency-explorer/data'

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
  resources: Array<{ id: string; relation: string }>
}

export function buildFileIndex(map: ConnectivityMap, routes: MonolithRoute[] = [], relations: ResourceRelation[] = []): Map<string, FileIndexEntry> {
  const index = new Map<string, FileIndexEntry>()
  const entryFor = (service: string, filePath: string): FileIndexEntry => {
    const key = `${service}/${filePath}`
    const existing = index.get(key)
    if (existing) {
      return existing
    }
    const created: FileIndexEntry = { service, path: filePath, flows: [], labels: [], routes: [], resources: [] }
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
  for (const r of relations) {
    if (!r.file) {
      continue
    }
    const entry = entryFor(r.service, r.file)
    if (!entry.resources.some(x => x.id === r.resource && x.relation === r.relation)) {
      entry.resources.push({ id: r.resource, relation: r.relation })
    }
  }
  return index
}
