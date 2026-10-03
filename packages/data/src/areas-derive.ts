import type { CodeLocation, ConnectivityMap, DatabaseType, ExternalSystem, ProductArea, ServiceFlow } from '@dependency-explorer/schema'
import { globToRegExp } from './glob'

const compiled = new Map<string, RegExp>()

function regexFor(glob: string): RegExp {
  const cached = compiled.get(glob)
  if (cached) {
    return cached
  }
  const re = globToRegExp(glob)
  compiled.set(glob, re)
  return re
}

export function locationMatches(loc: CodeLocation, repo: string, filePath: string): boolean {
  return loc.repo === repo && loc.globs.some(g => regexFor(g).test(filePath))
}

export function areasForFile(repo: string, filePath: string, areas: ProductArea[]): ProductArea[] {
  return areas.filter(a => a.codeLocations.some(l => locationMatches(l, repo, filePath)))
}

export function getFlowAreas(flow: ServiceFlow, areas: ProductArea[]): ProductArea[] {
  const hit = new Set<string>()
  for (const unit of flow.codeUnits ?? []) {
    if (!unit.path) {
      continue
    }
    for (const area of areasForFile(unit.service, unit.path, areas)) {
      hit.add(area.id)
    }
  }
  return areas.filter(a => hit.has(a.id))
}

export function getAreaFlows(area: ProductArea, flows: ServiceFlow[], areas: ProductArea[]): ServiceFlow[] {
  return flows.filter(f => getFlowAreas(f, areas).some(a => a.id === area.id))
}

export function getAreaServices(area: ProductArea): string[] {
  return [...new Set(area.codeLocations.map(l => l.repo))]
}

function claimsWholeRepo(area: ProductArea, service: string): boolean {
  return area.codeLocations.some(l => l.repo === service && l.globs.includes('**'))
}

export function getAreaExternals(area: ProductArea, externals: ExternalSystem[]): ExternalSystem[] {
  return externals.filter(e => e.usedBy.some(u => claimsWholeRepo(area, u.service)))
}

export function getSharedExternals(areas: ProductArea[], externals: ExternalSystem[]): ExternalSystem[] {
  return externals.filter(e => areas.every(a => getAreaExternals(a, [e]).length === 0))
}

export function getServiceLane(service: string, areas: ProductArea[]): ProductArea | undefined {
  return areas.find(a => a.kind === 'product' && claimsWholeRepo(a, service))
    ?? areas.find(a => claimsWholeRepo(a, service))
}

export interface CrossAreaEdge {
  service: string
  otherArea: string
  direction: 'out' | 'in'
  count: number
}

export function getCrossAreaEdges(area: ProductArea, map: ConnectivityMap): CrossAreaEdge[] {
  const areas = map.areas ?? []
  const mine = new Set(getAreaServices(area).filter(s => getServiceLane(s, areas)?.id === area.id))
  const counts = new Map<string, CrossAreaEdge>()
  const bump = (service: string, other: string | undefined, direction: 'out' | 'in') => {
    if (!other || other === area.id) {
      return
    }
    const key = `${service}|${other}|${direction}`
    const edge = counts.get(key) ?? { service, otherArea: other, direction, count: 0 }
    edge.count++
    counts.set(key, edge)
  }
  for (const c of map.connections) {
    if (mine.has(c.from)) {
      bump(c.from, getServiceLane(c.to, areas)?.id, 'out')
    }
    if (mine.has(c.to)) {
      bump(c.to, getServiceLane(c.from, areas)?.id, 'in')
    }
  }
  return [...counts.values()]
}

const CLIENT_TYPES = new Set(['vue-frontend', 'react-native'])

export interface ContextLanes {
  clients: string[]
  monolith: string[]
  lanes: Array<{ area: ProductArea; services: string[] }>
  unlaned: string[]
  stores: DatabaseType[]
  externals: ExternalSystem[]
}

export function buildContextLanes(map: ConnectivityMap): ContextLanes {
  const areas = map.areas ?? []
  const clients = map.services.filter(s => CLIENT_TYPES.has(s.type) || s.name === 'superadmin').map(s => s.name)
  const monolith = map.services.filter(s => s.type === 'rails-monolith').map(s => s.name)
  const hosted = new Set([...clients, ...monolith])
  const byArea = new Map<string, string[]>()
  const unlaned: string[] = []
  for (const svc of map.services) {
    if (hosted.has(svc.name)) {
      continue
    }
    const lane = getServiceLane(svc.name, areas)
    if (lane) {
      byArea.set(lane.id, [...(byArea.get(lane.id) ?? []), svc.name])
    } else {
      unlaned.push(svc.name)
    }
  }
  return {
    clients,
    monolith,
    lanes: areas.filter(a => byArea.has(a.id)).map(area => ({ area, services: byArea.get(area.id) ?? [] })),
    unlaned,
    stores: [...new Set(map.services.flatMap(s => (s.databases ?? []).map(d => d.type)))],
    externals: map.externals ?? [],
  }
}
