import type { ConnectivityMap, ServiceFlow, FeatureFlagRef } from '@dependency-explorer/data'

/**
 * The flag → flows registry — DERIVED from the dataset at build time, never
 * authored (docs/spec.md §3). A flag exists here iff at least one flow's code
 * unit or edge carries a typed ref to it.
 */
export interface FlagRegistryEntry {
  name: string
  kind: FeatureFlagRef['kind']
  scope?: string
  flows: ServiceFlow[]
}

export function buildFlagRegistry(map: ConnectivityMap): Map<string, FlagRegistryEntry> {
  const registry = new Map<string, FlagRegistryEntry>()
  for (const flow of map.flows) {
    const refs = [
      ...(flow.codeUnits ?? []).flatMap(u => u.flags ?? []),
      ...(flow.codeEdges ?? []).flatMap(e => e.flags ?? []),
    ]
    for (const ref of refs) {
      const entry = registry.get(ref.name)
      if (entry) {
        if (!entry.flows.some(f => f.id === flow.id)) entry.flows.push(flow)
      } else {
        registry.set(ref.name, { name: ref.name, kind: ref.kind, scope: ref.scope, flows: [flow] })
      }
    }
  }
  return registry
}
