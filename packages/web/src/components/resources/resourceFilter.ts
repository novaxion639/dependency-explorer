import type { Resource, ServiceFlow, TableListenerMetrics } from '@dependency-explorer/data'

export type ResourceSort = 'name' | 'listeners' | 'alsoChanges' | 'bypassing'
export interface ResourceFilter { kind: Resource['kind'] | 'all'; owner: string; orphansOnly: boolean; cyclesOnly: boolean; sort: ResourceSort }

export function filterResources(resources: Resource[], { kind, owner, orphansOnly, cyclesOnly, sort }: ResourceFilter, metrics: Map<string, TableListenerMetrics>, flows: ServiceFlow[]): Resource[] {
  const inFlow = new Set(flows.flatMap(f => (f.infraNodes ?? []).flatMap(n => n.resources ?? [])))
  const kept = resources.filter(r => (kind === 'all' || r.kind === kind) && (owner === 'all' || r.owner === owner) && (!orphansOnly || !inFlow.has(r.id)) && (!cyclesOnly || metrics.get(r.id)?.onCycle === true))
  if (sort === 'name') {
    return kept
  }
  const value = (r: Resource) => metrics.get(r.id)?.[sort] ?? 0
  return [...kept].sort((a, b) => value(b) - value(a) || a.name.localeCompare(b.name))
}
