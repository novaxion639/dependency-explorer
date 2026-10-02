import type { Resource } from '@dependency-explorer/data'
import { connectivityMap } from '@dependency-explorer/data'

export interface ResourceFilter { kind: Resource['kind'] | 'all'; owner: string; orphansOnly: boolean }

const inFlow = new Set(connectivityMap.flows.flatMap(f => (f.infraNodes ?? []).flatMap(n => n.resources ?? [])))

export function filterResources(resources: Resource[], { kind, owner, orphansOnly }: ResourceFilter): Resource[] {
  return resources.filter(r => (kind === 'all' || r.kind === kind) && (owner === 'all' || r.owner === owner) && (!orphansOnly || !inFlow.has(r.id)))
}
