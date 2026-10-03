import { describe, it, expect } from 'vitest'
import { connectivityMap as map } from '@dependency-explorer/data'
import { layoutProblems } from '../layoutProblems'
import { areaEdges, areaEndpoint, areaGraph, areaSteps, defaultMinWeight } from './areaGraph'
import { areaId, CLIENTS_ID, MONOLITH_ID, PLATFORM_ID } from './ids'

const product = (map.areas ?? []).filter(a => a.kind === 'product')

describe('areaGraph', () => {
  it('aggregates every connection between two different ends exactly once', () => {
    const end = areaEndpoint(map)
    const expected = map.connections.filter(c => {
      const from = end(c.from)
      const to = end(c.to)
      return from !== null && to !== null && from !== to
    }).length
    expect(areaEdges(map).reduce((n, e) => n + e.weight, 0)).toBe(expected)
  })
  it('keeps at most 24 edges by default, and no stricter threshold than needed', () => {
    const edges = areaEdges(map)
    const w = defaultMinWeight(edges)
    expect(edges.filter(e => e.weight >= w).length).toBeLessThanOrEqual(24)
    if (w > 1) {
      expect(edges.filter(e => e.weight >= w - 1).length).toBeGreaterThan(24)
    }
  })
  it('fits 1440×900 with every product area, the monolith and both bands', () => {
    for (const min of [1, defaultMinWeight(areaEdges(map))]) {
      const m = areaGraph(map, min)
      expect(m.width).toBeLessThanOrEqual(1440)
      expect(m.height).toBeLessThanOrEqual(900)
      expect(layoutProblems(m)).toEqual([])
    }
    const ids = areaGraph(map, 1).nodes.map(n => n.id)
    expect(ids).toEqual(expect.arrayContaining([...product.map(a => areaId(a.id)), CLIENTS_ID, PLATFORM_ID, MONOLITH_ID]))
  })
  it('hides weaker edges without moving any node', () => {
    const all = areaGraph(map, 1)
    const strong = areaGraph(map, 3)
    expect(strong.edges.every(e => e.weight >= 3)).toBe(true)
    expect(strong.edges.length).toBeLessThan(all.edges.length)
    expect(strong.nodes).toEqual(all.nodes)
  })
  it('steps through every product area, most connected first', () => {
    const edges = areaEdges(map)
    const steps = areaSteps(map, edges)
    const total = (id: string) => edges.filter(e => e.from === areaId(id) || e.to === areaId(id)).reduce((n, e) => n + e.weight, 0)
    expect(new Set(steps)).toEqual(new Set(product.map(a => a.id)))
    expect(steps.map(total)).toEqual([...steps.map(total)].sort((a, b) => b - a))
  })
})
