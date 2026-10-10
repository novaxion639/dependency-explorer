import { describe, it, expect } from 'vitest'
import { ListenerSchema } from '@dependency-explorer/data'
import { effectText, filterListeners, listenerLabel, sourceHref } from './listenerView'

const at = { file: 'app/models/shift.rb', line: 196 }
const make = (id: string, kind: string, events: string[], grade: string) => ListenerSchema.parse({
  id, table: 'pg:skello_production.shifts', kind, hook: 'after_commit', events, phase: 'commit', declaredAt: at, grade: 'code',
  effects: [{ kind: 'writes', target: 'pg:skello_production.weekly_options', mode: 'async-job', runs: 'none', events: ['update'], via: 'ShiftCallbackJob', at, grade }],
})
const listeners = [make('a', 'callback', ['update'], 'constant'), make('b', 'cascade', ['destroy'], 'text')]

describe('filterListeners', () => {
  it('filters by event, kind and grade', () => {
    expect(filterListeners(listeners, { lev: 'destroy', lkind: null, lgrade: null }).map(l => l.id)).toEqual(['b'])
    expect(filterListeners(listeners, { lev: null, lkind: 'callback', lgrade: null }).map(l => l.id)).toEqual(['a'])
    expect(filterListeners(listeners, { lev: null, lkind: null, lgrade: 'text' }).map(l => l.id)).toEqual(['b'])
    expect(filterListeners(listeners, { lev: null, lkind: null, lgrade: 'verified' }).map(l => l.id)).toEqual(['a'])
  })
})

describe('effectText', () => {
  it('reads a write with its runs, events, mode and chain', () => {
    const effect = listeners.flatMap(l => l.effects)[0]
    expect(effect).toBeDefined()
    expect(effect && effectText(effect)).toBe('writes weekly_options · runs none · update · async · via ShiftCallbackJob')
  })
})

describe('effectText without runs', () => {
  it('reads a missing runs as none, as the cascade does', () => {
    const listener = ListenerSchema.parse({
      id: 'c', table: 'pg:skello_production.shifts', kind: 'callback', hook: 'after_commit', events: ['update'], phase: 'commit', declaredAt: at, grade: 'code',
      effects: [{ kind: 'writes', target: 'pg:skello_production.weekly_options', mode: 'sync', events: ['update'], at, grade: 'constant' }],
    })
    const effect = listener.effects[0]
    expect(effect && effectText(effect)).toBe('writes weekly_options · runs none · update')
  })
})

describe('sourceHref', () => {
  it('links a line at the pinned commit', () => {
    expect(sourceHref(at, { 'skello-app': 'abc' })).toBe('https://github.com/skelloapp/skello-app/blob/abc/app/models/shift.rb#L196')
  })
})

describe('listenerLabel', () => {
  const labelled = (kind: string, id: string, hook: string, method?: string) => ListenerSchema.parse({ id, table: 'pg:skello_production.shifts', kind, hook, method, events: ['update'], phase: 'commit', declaredAt: at, grade: 'code', effects: [] })
  it('names a callback by method or block, a cascade or touch by its target, a gem by its macro', () => {
    expect(listenerLabel(labelled('callback', 'shifts.after_commit.x', 'after_commit', 'update_paid_leaves'))).toBe('update_paid_leaves')
    expect(listenerLabel(labelled('callback', 'shifts.after_commit.y', 'after_commit'))).toBe('block')
    expect(listenerLabel(labelled('cascade', 'shifts.dependent.shift_swaps', 'dependent: :delete_all'))).toBe('dependent: :delete_all shift_swaps')
    expect(listenerLabel(labelled('touch', 'contracts.touch.user', 'touch: true'))).toBe('touch: true user')
    expect(listenerLabel(labelled('gem', 'api_keys.has_secure_token', 'has_secure_token'))).toBe('has_secure_token')
  })
})
