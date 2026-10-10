import { describe, it, expect } from 'vitest'
import { ListenerSchema, ListenerSurfaceSchema, WriteSiteSchema } from '@dependency-explorer/schema'
import { surfaceDrift } from './listener-check'

const listener = (id: string) => ListenerSchema.parse({ id, table: 'pg:skello_production.shifts', kind: 'callback', hook: 'after_commit', events: ['update'], phase: 'commit', declaredAt: { file: 'app/models/shift.rb', line: 1 }, effects: [], grade: 'code' })
const site = (file: string, line: number) => WriteSiteSchema.parse({ table: 'pg:skello_production.shifts', file, line, call: 'update!', events: ['update'], runs: 'all', grade: 'text' })

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
})
