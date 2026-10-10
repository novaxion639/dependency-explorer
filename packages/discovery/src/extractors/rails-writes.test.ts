import { describe, it, expect } from 'vitest'
import { linesOf, sqlWritesIn, writesIn, type WriteResolver } from './rails-writes'

const tables = new Map([
  ['Shift', 'shifts'],
  ['Membership', 'memberships'],
  ['Badging', 'badgings'],
  ['PredictedShift', 'predicted_shifts'],
])
const ctx: WriteResolver = {
  byClass: new Map([...tables].map(([cls, table]): [string, { table: string }] => [cls, { table }])),
  classes: new Set(tables.keys()),
  associations: new Map(),
}
const lines = (...texts: string[]) => linesOf(texts.join('\n'), 1)

describe('writesIn', () => {
  it('grades a class-level write constant and reads its runs and events', () => {
    expect(writesIn(lines('Shift.unscoped.where(id: ids).update_all(color: c)'), null, ctx)).toEqual([
      { table: 'shifts', call: 'update_all', kind: { runs: 'none', events: ['update'] }, grade: 'constant', line: 1 },
    ])
  })
  it('reads an import as validation-only unless validate: false sits in the call', () => {
    expect(writesIn(lines('Shift.import!(', '  shifts,', '  validate: false', ')'), null, ctx).map(h => h.kind.runs)).toEqual(['none'])
    expect(writesIn(lines('Shift.import!(shifts)'), null, ctx).map(h => h.kind.runs)).toEqual(['validation'])
  })
  it('follows safe navigation and grades a named receiver text', () => {
    expect(writesIn(lines('shift.badging&.update(shift_id: nil)'), null, ctx)).toEqual([
      { table: 'badgings', call: 'update', kind: { runs: 'all', events: ['update'] }, grade: 'text', line: 1 },
    ])
    expect(writesIn(lines('Membership.find_by(user_id: user_id, shop_id: shop_id)&.update!(poste_id: poste_id)'), null, ctx).map(h => [h.table, h.grade])).toEqual([['memberships', 'constant']])
  })
  it('reads a save on a first_or_initialize chain as create and update', () => {
    expect(writesIn(lines('PredictedShift.where(shift_id: id).first_or_initialize.update!(x: 1)'), null, ctx)[0]?.kind.events).toEqual(['create', 'update'])
  })
  it('credits bare writes and bare query chains to the enclosing model', () => {
    expect(writesIn(lines('  update_columns(a: 1)', '  where(a: 1).delete_all'), { table: 'shifts' }, ctx).map(h => [h.table, h.call])).toEqual([
      ['shifts', 'update_columns'],
      ['shifts', 'delete_all'],
    ])
  })
  it('never credits a receiver it cannot tie to a model', () => {
    expect(writesIn(lines('@shifts_params.delete_all', 'Rails.cache.delete(key)', 'params.update(a: 1)'), null, ctx)).toEqual([])
  })
})

describe('sqlWritesIn', () => {
  it('reads INSERT … ON CONFLICT DO UPDATE as create and update on a known table', () => {
    const sql = lines('INSERT INTO weekly_options (shop_id) VALUES (?)', 'ON CONFLICT (shop_id) DO UPDATE SET up_to_date = false', 'DELETE FROM unknown_things')
    expect(sqlWritesIn(sql, new Set(['weekly_options']))).toEqual([
      { table: 'weekly_options', call: 'SQL INSERT INTO', kind: { runs: 'none', events: ['create', 'update'] }, grade: 'constant', line: 1 },
    ])
  })
})
