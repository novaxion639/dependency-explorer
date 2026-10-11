import { describe, it, expect } from 'vitest'
import type { TableListenerMetrics } from '@dependency-explorer/data'
import { allResourceRelations, connectivityMap, resourceSurface } from '@dependency-explorer/data'
import { filterResources } from './resourceFilter'

const all = { kind: 'all', owner: 'all', orphansOnly: false, cyclesOnly: false, sort: 'name' } as const
const noMetrics = new Map<string, TableListenerMetrics>()

describe('filterResources', () => {
  it('counts a resource as in a flow when any infra node names it, edges or not', () => {
    const linked = new Set(connectivityMap.flows.flatMap(f => (f.infraNodes ?? []).flatMap(n => n.resources ?? [])))
    const flowGraded = new Set(allResourceRelations.filter(r => r.grade === 'flow').map(r => r.resource))
    const edgeless = [...linked].find(id => !flowGraded.has(id))
    expect(edgeless, 'some infra node carries a resource no flow edge reaches').toBeDefined()
    const orphans = filterResources(resourceSurface.resources, { ...all, orphansOnly: true }, noMetrics).map(r => r.id)
    expect(orphans).not.toContain(edgeless)
    expect(orphans.every(id => !linked.has(id))).toBe(true)
  })
  it('filters by owner', () => {
    const owned = filterResources(resourceSurface.resources, { ...all, owner: 'svc-punch' }, noMetrics)
    expect(owned.length).toBeGreaterThan(0)
    expect(owned.every(r => r.owner === 'svc-punch')).toBe(true)
  })
  it('sorts tables by a listener metric and keeps only cycles on request', () => {
    const r = (id: string) => ({ id, kind: 'table' as const, store: 'postgresql' as const, name: id, evidence: [] })
    const metrics = new Map([
      ['a', { listeners: 1, alsoChanges: 5, async: 0, bypassing: 0, onCycle: true }],
      ['b', { listeners: 9, alsoChanges: 1, async: 0, bypassing: 3, onCycle: false }],
    ])
    expect(filterResources([r('a'), r('b')], { ...all, sort: 'listeners' }, metrics).map(x => x.id)).toEqual(['b', 'a'])
    expect(filterResources([r('a'), r('b')], { ...all, sort: 'alsoChanges' }, metrics).map(x => x.id)).toEqual(['a', 'b'])
    expect(filterResources([r('a'), r('b')], { ...all, cyclesOnly: true }, metrics).map(x => x.id)).toEqual(['a'])
  })
})
