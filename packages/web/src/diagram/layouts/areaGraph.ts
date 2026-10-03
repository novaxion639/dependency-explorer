import { Graph, layout } from '@dagrejs/dagre'
import { buildContextLanes, getServiceLane, type ConnectivityMap } from '@dependency-explorer/data'
import { aggregateEdges } from '../aggregate'
import { linesHeight } from '../geometry'
import { ALL_RENDERERS, type DiagramEdge, type DiagramModel, type DiagramNode } from '../model'
import { areaId, CLIENTS_ID, MONOLITH_ID, PLATFORM_ID } from './ids'

const FONT = 16
const NODE_W = 260
const NODE_H = linesHeight(1, FONT)
const BAND_H = linesHeight(2, FONT)
const GAP = 48
const EDGE_BUDGET = 24

export function areaEndpoint(map: ConnectivityMap): (service: string) => string | null {
  const areas = map.areas ?? []
  const ctx = buildContextLanes(map)
  return service => {
    if (ctx.clients.includes(service)) {
      return CLIENTS_ID
    }
    if (ctx.monolith.includes(service)) {
      return MONOLITH_ID
    }
    const lane = getServiceLane(service, areas)
    if (!lane) {
      return null
    }
    return lane.kind === 'platform' ? PLATFORM_ID : areaId(lane.id)
  }
}

export function areaEdges(map: ConnectivityMap): DiagramEdge[] {
  const end = areaEndpoint(map)
  return aggregateEdges(map.connections, c => {
    const from = end(c.from)
    const to = end(c.to)
    return from && to ? [from, to] : null
  })
}

export function defaultMinWeight(edges: DiagramEdge[]): number {
  const weights = [...new Set(edges.map(e => e.weight))].sort((a, b) => a - b)
  return weights.find(w => edges.filter(e => e.weight >= w).length <= EDGE_BUDGET) ?? 1
}

export function areaSteps(map: ConnectivityMap, edges: DiagramEdge[]): string[] {
  const total = (id: string) => edges.filter(e => e.from === areaId(id) || e.to === areaId(id)).reduce((n, e) => n + e.weight, 0)
  return (map.areas ?? [])
    .filter(a => a.kind === 'product')
    .sort((a, b) => total(b.id) - total(a.id) || a.name.localeCompare(b.name))
    .map(a => a.id)
}

export function areaGraph(map: ConnectivityMap, minWeight: number): DiagramModel {
  const ctx = buildContextLanes(map)
  const areas = map.areas ?? []
  const all = areaEdges(map)
  const middle: DiagramNode[] = [
    ...areas.filter(a => a.kind === 'product').map((a): DiagramNode => ({
      id: areaId(a.id), kind: 'area', label: a.name, detail: [], stores: [], fontSize: FONT, x: 0, y: 0, w: NODE_W, h: NODE_H, ref: { type: 'area', id: a.id },
    })),
    ...ctx.monolith.map((s): DiagramNode => ({
      id: MONOLITH_ID, kind: 'monolith', label: s, detail: [], stores: [], fontSize: FONT, x: 0, y: 0, w: NODE_W, h: NODE_H, ref: { type: 'service', name: s },
    })),
  ]
  const ids = new Set(middle.map(n => n.id))
  const pairWeight = new Map<string, number>()
  for (const e of all) {
    if (ids.has(e.from) && ids.has(e.to)) {
      const key = [e.from, e.to].sort().join('|')
      pairWeight.set(key, (pairWeight.get(key) ?? 0) + e.weight)
    }
  }
  const g = new Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 20, ranksep: 90, marginx: 0, marginy: 0 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const n of middle) {
    g.setNode(n.id, { width: n.w, height: n.h })
  }
  for (const [key, weight] of pairWeight) {
    const [a, b] = key.split('|')
    if (a && b) {
      g.setEdge(a, b, { weight })
    }
  }
  layout(g)
  const laid = middle.map(n => {
    const p = g.node(n.id)
    return { ...n, x: Math.round((p.x ?? 0) - n.w / 2), y: Math.round((p.y ?? 0) - n.h / 2) + BAND_H + GAP }
  })
  const width = Math.max(...laid.map(n => n.x + n.w))
  const bottom = Math.max(...laid.map(n => n.y + n.h))
  const platform = areas.filter(a => a.kind === 'platform').map(a => a.name)
  const bands: DiagramNode[] = [
    { id: CLIENTS_ID, kind: 'summary', label: 'Clients', detail: [ctx.clients.join(' · ')], stores: [], fontSize: FONT, x: 0, y: 0, w: width, h: BAND_H },
    { id: PLATFORM_ID, kind: 'summary', label: 'Platform', detail: [platform.join(' · ')], stores: [], fontSize: FONT, x: 0, y: bottom + GAP, w: width, h: BAND_H },
  ]
  return {
    id: 'area-graph', title: 'How product areas connect', width, height: bottom + GAP + BAND_H,
    nodes: [...bands, ...laid], groups: [], edges: all.filter(e => e.weight >= minWeight), renderers: ALL_RENDERERS,
  }
}
