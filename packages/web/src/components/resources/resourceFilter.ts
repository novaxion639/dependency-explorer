import type { Resource, TableListenerMetrics } from '@dependency-explorer/data'
import { connectivityMap } from '@dependency-explorer/data'

export type ResourceSort = 'name' | 'listeners' | 'alsoChanges' | 'bypassing'
export interface ResourceFilter { kind: Resource['kind'] | 'all'; owner: string; orphansOnly: boolean; cyclesOnly: boolean; sort: ResourceSort }

const inFlow = new Set(connectivityMap.flows.flatMap(f => (f.infraNodes ?? []).flatMap(n => n.resources ?? [])))

export function filterResources(resources: Resource[], { kind, owner, orphansOnly, cyclesOnly, sort }: ResourceFilter, metrics: Map<string, TableListenerMetrics>): Resource[] {
  const kept = resources.filter(r => (kind === 'all' || r.kind === kind) && (owner === 'all' || r.owner === owner) && (!orphansOnly || !inFlow.has(r.id)) && (!cyclesOnly || metrics.get(r.id)?.onCycle === true))
  if (sort === 'name') {
    return kept
  }
  const value = (r: Resource) => metrics.get(r.id)?.[sort] ?? 0
  return [...kept].sort((a, b) => value(b) - value(a) || a.name.localeCompare(b.name))
}
