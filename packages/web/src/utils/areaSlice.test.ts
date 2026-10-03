import { describe, it, expect } from 'vitest'
import { connectivityMap as map, monolithRoutes, resourceSurface } from '@dependency-explorer/data'
import { areaSlice } from './areaSlice'

describe('areaSlice', () => {
  const slice = areaSlice(map, monolithRoutes, resourceSurface.resources, 'planning')
  it('lists controllers by route count, tables, outside calls and flows', () => {
    expect(slice?.area.name).toBe('Planning')
    const routes = slice?.controllers.map(c => c.routes) ?? []
    expect(routes.length).toBeGreaterThan(0)
    expect(routes).toEqual([...routes].sort((a, b) => b - a))
    expect(slice?.tables.map(t => t.id)).toContain('pg:skello_production.shifts')
    expect(slice?.flows.map(f => f.id)).toContain('shift-creation')
    expect(slice?.calls.length).toBeGreaterThan(0)
    expect(slice?.calls).not.toContain('svc-shifts')
  })
  it('is null for an unknown area', () => {
    expect(areaSlice(map, monolithRoutes, resourceSurface.resources, 'nope')).toBeNull()
  })
})
