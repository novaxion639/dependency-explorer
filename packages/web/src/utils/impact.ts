import type { ConnectivityMap, ResourceRelation } from '@dependency-explorer/data'

export type Effect = 'fails' | 'degrades' | 'starves'
export interface ImpactEntry { node: string; hop: number; effect: Effect; via: string; mode: 'sync' | 'async' }
export interface ImpactResult { origin: string; entries: ImpactEntry[]; flows: Array<{ flowId: string; name: string; step: number; from: string; to: string }> }

export function computeImpact(map: ConnectivityMap, relations: ResourceRelation[], origin: string, maxHops = 4): ImpactResult {
  const entries = new Map<string, ImpactEntry>()
  const queue: Array<{ node: string; effect: Effect; hop: number }> = []
  const reach = (node: string, effect: Effect, hop: number, via: string, mode: 'sync' | 'async') => {
    if (node === origin || entries.has(node) || hop > maxHops) {
      return
    }
    entries.set(node, { node, hop, effect, via, mode })
    queue.push({ node, effect, hop })
  }
  const spread = (node: string, effect: Effect, hop: number) => {
    for (const c of map.connections) {
      if (effect === 'fails' && c.to === node) {
        reach(c.from, c.communicationType === 'sync' ? 'fails' : 'degrades', hop + 1, node, c.communicationType)
      }
      if ((effect === 'fails' || effect === 'starves') && c.from === node && c.communicationType === 'async') {
        reach(c.to, 'starves', hop + 1, node, 'async')
      }
    }
  }
  const isResource = relations.some(r => r.resource === origin)
  if (isResource) {
    for (const r of relations.filter(x => x.resource === origin)) {
      reach(r.service, r.relation === 'consumes' ? 'starves' : 'fails', 1, origin, r.relation === 'consumes' ? 'async' : 'sync')
    }
  } else {
    spread(origin, 'fails', 0)
  }
  for (let next = queue.shift(); next; next = queue.shift()) {
    spread(next.node, next.effect, next.hop)
  }
  const failing = new Set([origin, ...[...entries.values()].filter(e => e.effect === 'fails').map(e => e.node)])
  const flows = map.flows.flatMap(f => {
    const index = f.steps.findIndex(s => failing.has(s.to))
    const step = f.steps[index]
    return step ? [{ flowId: f.id, name: f.name, step: index + 1, from: step.from, to: step.to }] : []
  })
  return { origin, entries: [...entries.values()].sort((a, b) => a.hop - b.hop || a.node.localeCompare(b.node)), flows }
}
