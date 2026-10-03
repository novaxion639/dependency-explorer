import type { ConnectivityMap, ResourceRelation } from '@dependency-explorer/data'
import { serviceId } from '../diagram/layouts/ids'

export type Effect = 'fails' | 'degrades' | 'starves'
export interface ImpactEntry { node: string; hop: number; effect: Effect; via: string; mode: 'sync' | 'async' }
export interface ImpactResult { origin: string; entries: ImpactEntry[]; flows: Array<{ flowId: string; name: string; step: number; from: string; to: string }> }

const EFFECT_RANK: Record<Effect, number> = { fails: 3, starves: 2, degrades: 1 }

export function computeImpact(map: ConnectivityMap, relations: ResourceRelation[], origin: string, maxHops = 4): ImpactResult {
  const entries = new Map<string, ImpactEntry>()
  const offer = (level: Map<string, ImpactEntry>, candidate: ImpactEntry) => {
    if (candidate.node === origin || entries.has(candidate.node) || candidate.hop > maxHops) {
      return
    }
    const current = level.get(candidate.node)
    if (!current || EFFECT_RANK[candidate.effect] > EFFECT_RANK[current.effect]) {
      level.set(candidate.node, candidate)
    }
  }
  const spread = (level: Map<string, ImpactEntry>, node: string, effect: Effect, hop: number) => {
    for (const c of map.connections) {
      if (effect === 'fails' && c.to === node) {
        offer(level, { node: c.from, hop: hop + 1, effect: c.communicationType === 'sync' ? 'fails' : 'degrades', via: node, mode: c.communicationType })
      }
      if ((effect === 'fails' || effect === 'starves') && c.from === node && c.communicationType === 'async') {
        offer(level, { node: c.to, hop: hop + 1, effect: 'starves', via: node, mode: 'async' })
      }
    }
  }
  const isResource = relations.some(r => r.resource === origin)
  let level = new Map<string, ImpactEntry>()
  if (isResource) {
    for (const r of relations.filter(x => x.resource === origin)) {
      const consumes = r.relation === 'consumes'
      offer(level, { node: r.service, hop: 1, effect: consumes ? 'starves' : 'fails', via: origin, mode: consumes ? 'async' : 'sync' })
    }
  } else {
    spread(level, origin, 'fails', 0)
  }
  while (level.size) {
    for (const e of level.values()) {
      entries.set(e.node, e)
    }
    const next = new Map<string, ImpactEntry>()
    for (const e of level.values()) {
      spread(next, e.node, e.effect, e.hop)
    }
    level = next
  }
  const direct = new Set([origin, ...(isResource ? [...entries.values()].filter(e => e.hop === 1 && e.effect === 'fails').map(e => e.node) : [])])
  const flows = map.flows.flatMap(f => {
    const index = f.steps.findIndex(s => direct.has(s.to))
    const step = f.steps[index]
    return step ? [{ flowId: f.id, name: f.name, step: index + 1, from: step.from, to: step.to }] : []
  })
  return { origin, entries: [...entries.values()].sort((a, b) => a.hop - b.hop || a.node.localeCompare(b.node)), flows }
}

export function impactMarks(result: ImpactResult): Map<string, Effect | 'origin'> {
  const marks = new Map<string, Effect | 'origin'>(result.entries.map(e => [serviceId(e.node), e.effect]))
  marks.set(serviceId(result.origin), 'origin')
  return marks
}
