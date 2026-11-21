import { describe, it, expect } from 'vitest'
import type { TableListenerMetrics } from '@dependency-explorer/data'
import { shiftUpdateFlow } from '../../test/flowFixtures'
import { dataset } from '../../test/resourceFixtures'
import { filterResources } from './resourceFilter'

const all = { kind: 'all', owner: 'all', orphansOnly: false, cyclesOnly: false, sort: 'name' } as const
const noMetrics = new Map<string, TableListenerMetrics>()
const { resources } = dataset.resources

describe('filterResources', () => {
  it('counts a resource as in a flow when any infra node names it, edges or not', () => {
    const orphans = filterResources(resources, { ...all, orphansOnly: true }, noMetrics, [shiftUpdateFlow]).map(r => r.id)
    expect(orphans).not.toContain('pg:skello_production.shifts')
    expect(orphans).toContain('pg:skello_production.weekly_options')
  })
  it('filters by owner', () => {
    const owned = filterResources(resources, { ...all, owner: 'skello-app' }, noMetrics, [])
    expect(owned.map(r => r.id)).toEqual(['pg:skello_production.shifts', 'pg:skello_production.weekly_options', 'pg:skello_production.billing_infos'])
  })
  it('sorts tables by a listener metric and keeps only cycles on request', () => {
    const r = (id: string) => ({ id, kind: 'table' as const, store: 'postgresql' as const, name: id, evidence: [] })
    const metrics = new Map([
      ['a', { listeners: 1, alsoChanges: 5, async: 0, bypassing: 0, onCycle: true }],
      ['b', { listeners: 9, alsoChanges: 1, async: 0, bypassing: 3, onCycle: false }],
    ])
    expect(filterResources([r('a'), r('b')], { ...all, sort: 'listeners' }, metrics, []).map(x => x.id)).toEqual(['b', 'a'])
    expect(filterResources([r('a'), r('b')], { ...all, sort: 'alsoChanges' }, metrics, []).map(x => x.id)).toEqual(['a', 'b'])
    expect(filterResources([r('a'), r('b')], { ...all, cyclesOnly: true }, metrics, []).map(x => x.id)).toEqual(['a'])
  })
})
