import { describe, it, expect } from 'vitest'
import { joinStatements, linesOf, sqlWritesIn, writeKind, writesIn, type WriteResolver } from './rails-writes'

const tables = new Map([
  ['Shift', 'shifts'],
  ['Membership', 'memberships'],
  ['Badging', 'badgings'],
  ['PredictedShift', 'predicted_shifts'],
  ['PaidLeavesCounter', 'paid_leaves_counters'],
])
const ctx: WriteResolver = {
  byClass: new Map([...tables].map(([cls, table]): [string, { table: string }] => [cls, { table }])),
  classes: new Set(tables.keys()),
  associations: new Map(),
}
const lines = (...texts: string[]) => linesOf(texts.join('\n'), 1)

describe('joinStatements', () => {
  it('joins a leading-dot continuation and keeps the first line number', () => {
    expect(joinStatements(lines('Shift.where(id: ids)', '  .update_all(color: c)', 'other = 1'))).toEqual([
      { text: 'Shift.where(id: ids) .update_all(color: c)', line: 1 },
      { text: 'other = 1', line: 3 },
    ])
  })
  it('joins lines until the parens balance', () => {
    expect(joinStatements(lines('Shift.import!(', 'shifts,', ')'))).toEqual([{ text: 'Shift.import!( shifts, )', line: 1 }])
  })
})

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
  it('reads validate: false only from the call own arguments, however many lines they span', () => {
    expect(writesIn(lines('Shift.import!(', 'shifts,', 'a: 1,', 'b: 2,', 'c: 3,', 'd: 4,', 'validate: false', ')'), null, ctx).map(h => h.kind.runs)).toEqual(['none'])
  })
  it('ignores validate: false in a later unrelated statement', () => {
    expect(writesIn(lines('Shift.import!(shifts)', 'options = { validate: false }'), null, ctx).map(h => h.kind.runs)).toEqual(['validation'])
  })
  it('keeps a destroy when a later statement starts a first_or_initialize chain', () => {
    expect(writesIn(lines('shift.destroy!', 'Y.where(a: 1).first_or_initialize'), null, ctx)).toEqual([
      { table: 'shifts', call: 'destroy!', kind: { runs: 'all', events: ['destroy'] }, grade: 'text', line: 1 },
    ])
  })
  it('credits a leading-dot continuation to the receiver on the line above', () => {
    expect(writesIn(lines('Shift.where(id: ids)', '  .update_all(color: c)'), null, ctx)).toEqual([
      { table: 'shifts', call: 'update_all', kind: { runs: 'none', events: ['update'] }, grade: 'constant', line: 1 },
    ])
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
  it('does not credit hash keys named like a bare write', () => {
    expect(writesIn(lines('  touch: true,', '  create: x'), { table: 'shifts' }, ctx)).toEqual([])
  })
  it('credits a write whose receiver holds a nested call in its arguments', () => {
    expect(writesIn(lines('Shift.where(x: foo(y)).update_all(a: 1)'), null, ctx).map(h => [h.table, h.call])).toEqual([['shifts', 'update_all']])
    expect(writesIn(lines('PaidLeavesCounter.find_or_initialize_by(user_id: u, month: previous_year_month(plc, shop)).update!(a: 1)'), null, ctx).map(h => [h.table, h.call, h.kind.events])).toEqual([['paid_leaves_counters', 'update!', ['create', 'update']]])
  })
  it('reads a bare find_or_initialize_by chain inside a model as create and update', () => {
    expect(writesIn(lines('  find_or_initialize_by(user_id: u).update!(a: 1)'), { table: 'shifts' }, ctx).map(h => [h.table, h.kind.events])).toEqual([['shifts', ['create', 'update']]])
  })
  it('never credits a receiver it cannot tie to a model', () => {
    expect(writesIn(lines('@shifts_params.delete_all', 'Rails.cache.delete(key)', 'params.update(a: 1)'), null, ctx)).toEqual([])
  })
})

describe('writeKind', () => {
  it('answers only for its own keys', () => {
    expect(writeKind('toString', '', '')).toBeNull()
  })
  it('returns a fresh kind, never the shared table entry', () => {
    writeKind('update_all', '', '')?.events.push('create')
    expect(writeKind('update_all', '', '')).toEqual({ runs: 'none', events: ['update'] })
  })
})

describe('sqlWritesIn', () => {
  it('reads INSERT … ON CONFLICT DO UPDATE as create and update on a known table', () => {
    const sql = lines('INSERT INTO weekly_options (shop_id) VALUES (?)', 'ON CONFLICT (shop_id) DO UPDATE SET up_to_date = false', 'DELETE FROM unknown_things')
    expect(sqlWritesIn(sql, new Set(['weekly_options']))).toEqual([
      { table: 'weekly_options', call: 'SQL INSERT INTO', kind: { runs: 'none', events: ['create', 'update'] }, grade: 'constant', line: 1 },
    ])
  })
  it('reads UPDATE … SET split across lines at the line the statement starts', () => {
    expect(sqlWritesIn(lines('-- note', 'UPDATE weekly_options', '  SET up_to_date = false'), new Set(['weekly_options']))).toEqual([
      { table: 'weekly_options', call: 'SQL UPDATE', kind: { runs: 'none', events: ['update'] }, grade: 'constant', line: 2 },
    ])
  })
  it('reads DELETE FROM on a known table', () => {
    expect(sqlWritesIn(lines('DELETE FROM weekly_options', 'WHERE shop_id = ?'), new Set(['weekly_options']))).toEqual([
      { table: 'weekly_options', call: 'SQL DELETE FROM', kind: { runs: 'none', events: ['destroy'] }, grade: 'constant', line: 1 },
    ])
  })
})
