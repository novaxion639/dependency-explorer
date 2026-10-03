import { describe, it, expect } from 'vitest'
import { areaFacts, areasForFile, connectivityMap as map, monolithRoutes, resourceSurface } from '@dependency-explorer/data'
import { layoutProblems } from '../layoutProblems'
import { areaId } from './ids'
import { monolithRows, monolithTreemap } from './monolith'

const rows = monolithRows(map, monolithRoutes, resourceSurface.resources, areaFacts)
const areas = map.areas ?? []

describe('monolithRows', () => {
  it('ranks areas by files and ends with the unmapped code', () => {
    const mapped = rows.filter(r => r.areaId !== null)
    expect(mapped.map(r => r.files)).toEqual([...mapped.map(r => r.files)].sort((a, b) => b - a))
    const coverage = areaFacts.coverage['skello-app']
    expect(rows[rows.length - 1]).toMatchObject({ areaId: null, name: 'Not mapped yet', files: (coverage?.total ?? 0) - (coverage?.mapped ?? 0) })
  })
  it('counts routes from the controller files each area claims', () => {
    const claimed = (id: string) => monolithRoutes.filter(r => areasForFile('skello-app', r.controllerFile, areas).some(a => a.id === id)).length
    expect(rows.find(r => r.areaId === 'planning')?.routes).toBe(claimed('planning'))
    expect(rows.find(r => r.areaId === null)?.routes).toBe(monolithRoutes.filter(r => areasForFile('skello-app', r.controllerFile, areas).length === 0).length)
  })
  it('omits areas with no monolith code', () => {
    expect(rows.every(r => r.files + r.routes + r.tables > 0)).toBe(true)
    expect(rows.some(r => r.areaId === 'assistant')).toBe(false)
  })
})

describe('monolithTreemap', () => {
  const m = monolithTreemap(rows)
  it('lays out readable blocks within one screen', () => {
    expect(m.width).toBeLessThanOrEqual(1440)
    expect(m.height).toBeLessThanOrEqual(900)
    expect(layoutProblems(m)).toEqual([])
  })
  it('sizes blocks by files, merges small areas and hatches unmapped code', () => {
    expect(m.nodes.find(n => n.kind === 'unmapped')?.label).toBe('Not mapped yet')
    expect(m.nodes.find(n => n.kind === 'summary')?.label).toMatch(/^\d+ smaller areas$/)
    const area = (id: string) => m.nodes.find(n => n.id === areaId(id))
    const size = (id: string) => (area(id)?.w ?? 0) * (area(id)?.h ?? 0)
    expect(size('planning')).toBeGreaterThan(size('billing'))
    expect(area('planning')?.ref).toEqual({ type: 'area', id: 'planning' })
    expect(m.renderers).toEqual(['react-flow', 'svg'])
  })
})
