import { describe, it, expect } from 'vitest'
import { ListenerSchema, ListenerSurfaceSchema, WriteSiteSchema } from '@dependency-explorer/schema'
import type { ResourceRelation } from '@dependency-explorer/schema'
import { isCdcRelation, surfaceDrift } from './listener-check'

const effect = (target: string, line: number) => ({ kind: 'writes', target, mode: 'sync', events: ['update'], runs: 'all', at: { file: 'app/models/shift.rb', line }, grade: 'constant' })
const listener = (id: string, effects: unknown[] = [], line = 1) => ListenerSchema.parse({ id, table: 'pg:skello_production.shifts', kind: 'callback', hook: 'after_commit', events: ['update'], phase: 'commit', declaredAt: { file: 'app/models/shift.rb', line }, effects, grade: 'code' })
const site = (file: string, line: number, runs = 'all') => WriteSiteSchema.parse({ table: 'pg:skello_production.shifts', file, line, call: 'update!', events: ['update'], runs, grade: 'text' })
const surface = (listeners: ReturnType<typeof listener>[], writeSites: ReturnType<typeof site>[]) => ListenerSurfaceSchema.parse({ listeners, writeSites })
const drift = (live: { listeners: ReturnType<typeof listener>[]; writeSites: ReturnType<typeof site>[] }, committed: ReturnType<typeof surface>) => surfaceDrift({ ...live, cdc: [] }, { surface: committed, relations: [] })
const cdcRelation = (over: Partial<ResourceRelation> = {}): ResourceRelation => ({ resource: 'pg:skello_production.shifts', relation: 'feeds', service: 'skello-app', target: 'kinesis:skelloapp-bus', grade: 'config', ...over })

describe('surfaceDrift', () => {
  it('reports an absent committed surface once', () => {
    expect(surfaceDrift({ listeners: [listener('a')], writeSites: [], cdc: [] }, { surface: null, relations: [] }).map(f => f.subject)).toEqual(['listeners.json'])
  })
  it('reports added and removed listeners, ignoring write-site line moves', () => {
    const committed = ListenerSurfaceSchema.parse({ listeners: [listener('a'), listener('gone')], writeSites: [site('app/x.rb', 3)] })
    const findings = surfaceDrift({ listeners: [listener('a'), listener('new')], writeSites: [site('app/x.rb', 9)], cdc: [] }, { surface: committed, relations: [] })
    expect(findings.map(f => [f.kind, f.subject])).toEqual([['surface-drift', 'listener new'], ['surface-drift', 'listener gone']])
  })
  it('reports CDC relations missing from the committed registry', () => {
    const cdc = [{ resource: 'pg:skello_production.shifts', relation: 'feeds' as const, service: 'skello-app', target: 'kinesis:skelloapp-bus', grade: 'config' as const }]
    const committed = ListenerSurfaceSchema.parse({ listeners: [], writeSites: [] })
    expect(surfaceDrift({ listeners: [], writeSites: [], cdc }, { surface: committed, relations: [] }).map(f => f.subject)).toEqual(['CDC relation pg:skello_production.shifts|feeds|skello-app|kinesis:skelloapp-bus'])
  })
  it('reports a listener whose effects changed', () => {
    const findings = drift({ listeners: [listener('a', [effect('pg:skello_production.users', 4)])], writeSites: [] }, surface([listener('a', [effect('pg:skello_production.badgings', 4)])], []))
    expect(findings.map(f => [f.subject, f.detail.startsWith('listener changed')])).toEqual([['listener a', true]])
  })
  it('ignores a listener that only moved lines', () => {
    expect(drift({ listeners: [listener('a', [effect('pg:skello_production.users', 14)], 11)], writeSites: [] }, surface([listener('a', [effect('pg:skello_production.users', 4)], 1)], []))).toEqual([])
  })
  it('reports an added write site', () => {
    const findings = drift({ listeners: [], writeSites: [site('app/x.rb', 3), site('app/y.rb', 5)] }, surface([], [site('app/x.rb', 3)]))
    expect(findings.map(f => [f.subject, f.detail.startsWith('write site added')])).toEqual([['write site pg:skello_production.shifts app/y.rb update!', true]])
  })
  it('reports a removed write site', () => {
    const findings = drift({ listeners: [], writeSites: [] }, surface([], [site('app/x.rb', 3)]))
    expect(findings.map(f => [f.subject, f.detail.startsWith('write site removed')])).toEqual([['write site pg:skello_production.shifts app/x.rb update!', true]])
  })
  it('reports a second identical call in the same file', () => {
    const findings = drift({ listeners: [], writeSites: [site('app/x.rb', 3), site('app/x.rb', 9)] }, surface([], [site('app/x.rb', 3)]))
    expect(findings.map(f => f.detail.startsWith('write site added'))).toEqual([true])
  })
  it('reports an import whose runs changed, as one removed and one added signature', () => {
    const findings = drift({ listeners: [], writeSites: [site('app/x.rb', 3, 'none')] }, surface([], [site('app/x.rb', 3, 'validation')]))
    expect(findings.map(f => f.detail.split(' ').slice(0, 3).join(' ')).sort()).toEqual(['write site added', 'write site removed'])
  })
  it('reports a CDC relation removed from the pinned commit', () => {
    const committed = ListenerSurfaceSchema.parse({ listeners: [], writeSites: [] })
    const findings = surfaceDrift({ listeners: [], writeSites: [], cdc: [] }, { surface: committed, relations: [cdcRelation()] })
    expect(findings.map(f => [f.subject, f.detail.startsWith('CDC relation no longer')])).toEqual([['CDC relation pg:skello_production.shifts|feeds|skello-app|kinesis:skelloapp-bus', true]])
  })
})

describe('isCdcRelation', () => {
  it('keeps pg config feeds and consumes only', () => {
    expect(isCdcRelation(cdcRelation())).toBe(true)
    expect(isCdcRelation(cdcRelation({ relation: 'consumes' }))).toBe(true)
    expect(isCdcRelation(cdcRelation({ resource: 'dynamodb:shifts' }))).toBe(false)
    expect(isCdcRelation(cdcRelation({ grade: 'code' }))).toBe(false)
    expect(isCdcRelation(cdcRelation({ relation: 'writes' }))).toBe(false)
  })
})
