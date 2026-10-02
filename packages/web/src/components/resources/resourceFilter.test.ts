import { describe, it, expect } from 'vitest'
import { allResourceRelations, connectivityMap, resourceSurface } from '@dependency-explorer/data'
import { filterResources } from './resourceFilter'

const all = { kind: 'all', owner: 'all', orphansOnly: false } as const

describe('filterResources', () => {
  it('counts a resource as in a flow when any infra node names it, edges or not', () => {
    const linked = new Set(connectivityMap.flows.flatMap(f => (f.infraNodes ?? []).flatMap(n => n.resources ?? [])))
    const flowGraded = new Set(allResourceRelations.filter(r => r.grade === 'flow').map(r => r.resource))
    const edgeless = [...linked].find(id => !flowGraded.has(id))
    expect(edgeless, 'some infra node carries a resource no flow edge reaches').toBeDefined()
    const orphans = filterResources(resourceSurface.resources, { ...all, orphansOnly: true }).map(r => r.id)
    expect(orphans).not.toContain(edgeless)
    expect(orphans.every(id => !linked.has(id))).toBe(true)
  })
  it('filters by owner', () => {
    const owned = filterResources(resourceSurface.resources, { ...all, owner: 'svc-punch' })
    expect(owned.length).toBeGreaterThan(0)
    expect(owned.every(r => r.owner === 'svc-punch')).toBe(true)
  })
})
