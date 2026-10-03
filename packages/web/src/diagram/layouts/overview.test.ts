import { describe, it, expect } from 'vitest'
import { connectivityMap as map } from '@dependency-explorer/data'
import { layoutProblems } from '../layoutProblems'
import { areaId, CLIENTS_ID, MONOLITH_ID, PLATFORM_ID, serviceId } from './ids'
import { overviewMap } from './overview'

describe('overviewMap', () => {
  const plain = overviewMap(map, null)

  it('fits one 1440×900 screen with a sound layout', () => {
    expect(plain.width).toBeLessThanOrEqual(1440)
    expect(plain.height).toBeLessThanOrEqual(900)
    expect(layoutProblems(plain)).toEqual([])
  })
  it('places every service once: clients on top, the monolith on the left, services in their area', () => {
    expect(plain.nodes.map(n => n.id).sort()).toEqual(map.services.map(s => serviceId(s.name)).sort())
    expect(plain.groups.find(g => g.id === CLIENTS_ID)?.members).toContain(serviceId('skello-mobile'))
    expect(plain.groups.find(g => g.id === MONOLITH_ID)?.members).toEqual([serviceId('skello-app')])
    expect(plain.groups.find(g => g.id === areaId('time-attendance'))?.members).toEqual([serviceId('svc-punch')])
  })
  it('bands the six platform areas at the bottom', () => {
    const band = plain.groups.find(g => g.id === PLATFORM_ID)
    expect(band?.members).toEqual((map.areas ?? []).filter(a => a.kind === 'platform').map(a => areaId(a.id)))
    expect(band?.members).toHaveLength(6)
  })
  it('draws no edge until an area is selected', () => {
    expect(plain.edges).toEqual([])
  })
  it("draws only the selected area's edges, one per group pair and mode", () => {
    for (const area of map.areas ?? []) {
      const lit = overviewMap(map, areaId(area.id))
      expect(layoutProblems(lit), area.id).toEqual([])
      expect(lit.edges.every(e => e.from === areaId(area.id) || e.to === areaId(area.id)), area.id).toBe(true)
      expect(new Set(lit.edges.map(e => e.id)).size, area.id).toBe(lit.edges.length)
    }
    expect(overviewMap(map, areaId('planning')).edges.length).toBeGreaterThan(0)
  })
})
