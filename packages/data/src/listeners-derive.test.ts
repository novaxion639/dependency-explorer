import { describe, it, expect } from 'vitest'
import { ListenerSurfaceSchema, ServiceFlowSchema } from '@dependency-explorer/schema'
import { alsoChanges, cascadeFrom, flowListenerDrift, flowListeners, inRailsOrder, listenerMetrics, listenersRun } from './listeners-derive'

const t = (name: string) => `pg:skello_production.${name}`
const at = { file: 'app/models/x.rb', line: 1 }
const cb = (id: string, table: string, hook: string, phase: string, events: string[], effects: unknown[] = [], kind = 'callback') =>
  ({ id, table: t(table), kind, hook, events, phase, declaredAt: at, effects, grade: 'code' })
const writes = (table: string, runs: string, events: string[], mode = 'sync', grade = 'constant', via?: string) =>
  ({ kind: 'writes', target: t(table), mode, runs, events, at, grade, ...(via ? { via } : {}) })

const SURFACE = ListenerSurfaceSchema.parse({
  listeners: [
    cb('shifts.after_commit.set_weekly', 'shifts', 'after_commit', 'commit', ['create', 'update', 'destroy'], [
      { kind: 'enqueues', target: 'ShiftCallbackJob', targetFile: 'app/jobs/shift_callback_job.rb', mode: 'async-job', at, grade: 'constant' },
      writes('weekly_options', 'none', ['create', 'update'], 'async-job', 'constant', 'ShiftCallbackJob'),
    ]),
    cb('shifts.after_commit.manage_predicted', 'shifts', 'after_commit', 'commit', ['create', 'update', 'destroy'], [writes('predicted_shifts', 'all', ['create', 'update'])]),
    cb('shifts.before_save.set_poste', 'shifts', 'before_save', 'save', ['create', 'update'], [writes('memberships', 'all', ['update'])]),
    cb('shifts.before_validation.tz', 'shifts', 'before_validation', 'validation', ['create', 'update']),
    cb('memberships.after_commit.cleanup_cache', 'memberships', 'after_commit', 'commit', ['create', 'update', 'destroy']),
    cb('weekly_options.after_save.x', 'weekly_options', 'after_save', 'save', ['create', 'update']),
    cb('postes.dependent.shifts', 'postes', 'dependent: :destroy', 'event', ['destroy'], [writes('shifts', 'all', ['destroy'])], 'cascade'),
    cb('a.after_save.x', 'a', 'after_save', 'save', ['create', 'update'], [writes('b', 'all', ['update'], 'sync', 'text')]),
    cb('b.after_save.y', 'b', 'after_save', 'save', ['create', 'update'], [writes('a', 'all', ['update'], 'sync', 'graph')]),
    cb('cluster_nodes.has_ancestry', 'cluster_nodes', 'has_ancestry', 'event', ['update', 'destroy'], [writes('cluster_nodes', 'all', ['update'])], 'gem'),
    cb('contracts.touch.user', 'contracts', 'touch: true', 'event', ['create', 'update', 'destroy'], [], 'touch'),
    cb('contracts.touch.create_only', 'contracts', 'touch: true', 'event', ['create'], [], 'touch'),
  ],
  writeSites: [
    { table: t('shifts'), file: 'app/services/update_service.rb', line: 10, call: 'update!', events: ['update'], runs: 'all', grade: 'text' },
    { table: t('shifts'), file: 'app/services/auto_assign_save_service.rb', line: 4, call: 'update_all', events: ['update'], runs: 'none', grade: 'constant' },
    { table: t('shifts'), file: 'app/services/bulk_create_service.rb', line: 7, call: 'run_generic_callbacks!', events: ['create', 'update', 'destroy'], runs: 'subset', fires: ['shifts.after_commit.set_weekly'], grade: 'text' },
  ],
})

const ids = (ls: Array<{ id: string }>) => ls.map(l => l.id)
const shifts = SURFACE.listeners.filter(l => l.table === t('shifts'))
const contracts = SURFACE.listeners.filter(l => l.table === t('contracts'))

describe('inRailsOrder', () => {
  it('orders by phase and reverses commit callbacks', () => {
    expect(ids(inRailsOrder(shifts))).toEqual(['shifts.before_validation.tz', 'shifts.before_save.set_poste', 'shifts.after_commit.manage_predicted', 'shifts.after_commit.set_weekly'])
  })
})

describe('listenersRun', () => {
  it('selects by runs and events', () => {
    expect(ids(listenersRun({ runs: 'all', events: ['update'] }, shifts))).toHaveLength(4)
    expect(listenersRun({ runs: 'none', events: ['update'] }, shifts)).toEqual([])
    expect(ids(listenersRun({ runs: 'validation', events: ['create'] }, shifts))).toEqual(['shifts.before_validation.tz'])
    expect(ids(listenersRun({ runs: 'touch', events: ['update'] }, shifts))).toEqual(['shifts.after_commit.set_weekly', 'shifts.after_commit.manage_predicted'])
    expect(ids(listenersRun({ runs: 'touch', events: ['update'] }, contracts))).toEqual(['contracts.touch.user'])
    expect(ids(listenersRun({ runs: 'subset', events: ['update'], fires: ['shifts.after_commit.set_weekly'] }, shifts))).toEqual(['shifts.after_commit.set_weekly'])
  })
})

describe('cascadeFrom', () => {
  it('follows writes into the target table’s listeners and stops at a callback-skipping write', () => {
    const roots = cascadeFrom(SURFACE, t('shifts'), 'update')
    expect(ids(roots.map(n => n.listener))).toEqual(['shifts.before_validation.tz', 'shifts.before_save.set_poste', 'shifts.after_commit.manage_predicted', 'shifts.after_commit.set_weekly'])
    const poste = roots[1]?.hops[0]
    expect([poste?.table, poste?.mode, ids(poste?.next.map(n => n.listener) ?? [])]).toEqual([t('memberships'), 'sync', ['memberships.after_commit.cleanup_cache']])
    const weekly = roots[3]?.hops[0]
    expect([weekly?.table, weekly?.mode, weekly?.skipped, weekly?.next]).toEqual([t('weekly_options'), 'async', 1, []])
  })
  it('terminates on a cycle between two tables and grades the chain by its weakest hop', () => {
    const hop = cascadeFrom(SURFACE, t('a'), 'update')[0]?.hops[0]
    const back = hop?.next[0]?.hops[0]
    expect([hop?.grade, back?.table, back?.cycle, back?.grade]).toEqual(['text', t('a'), true, 'text'])
  })
  it('terminates on a table re-writing itself', () => {
    expect(cascadeFrom(SURFACE, t('cluster_nodes'), 'update')[0]?.hops[0]?.cycle).toBe(true)
  })
})

describe('cycles per table and event', () => {
  const LOOP = ListenerSurfaceSchema.parse({
    listeners: [
      cb('a.after_save.loop', 'a', 'after_save', 'save', ['create', 'update'], [writes('a', 'all', ['create', 'update'])]),
      cb('a.after_create.feed', 'a', 'after_create', 'event', ['create'], [writes('c', 'all', ['create'])]),
    ],
    writeSites: [],
  })
  const SELF_TOUCH = ListenerSurfaceSchema.parse({
    listeners: [
      cb('x.touch.self', 'x', 'touch: true', 'event', ['update'], [{ kind: 'writes', target: t('x'), mode: 'sync', runs: 'touch', at, grade: 'constant' }], 'touch'),
    ],
    writeSites: [],
  })

  it('marks a partly-seen write a cycle and still follows its fresh events', () => {
    const hop = cascadeFrom(LOOP, t('a'), 'update')[0]?.hops[0]
    expect([hop?.table, hop?.cycle]).toEqual([t('a'), true])
    expect(hop?.next.map(n => [n.listener.id, n.hops.map(h => h.table)])).toEqual([
      ['a.after_create.feed', [t('c')]],
      ['a.after_save.loop', [t('a')]],
    ])
    expect(hop?.next[1]?.hops[0]?.cycle).toBe(true)
  })
  it('defaults a write without events to every write event and terminates on a self-touch', () => {
    expect(cascadeFrom(SELF_TOUCH, t('x'), 'update')[0]?.hops[0]?.cycle).toBe(true)
  })
})

describe('alsoChanges', () => {
  it('lists each reachable table once, by its shortest path, never the origin, and only through listeners the event runs', () => {
    expect(alsoChanges(SURFACE, t('postes')).map(c => [c.table, c.via.length, c.mode])).toEqual([
      [t('shifts'), 1, 'sync'],
      [t('predicted_shifts'), 2, 'sync'],
      [t('weekly_options'), 2, 'async'],
    ])
  })
})

const flow = ServiceFlowSchema.parse({
  id: 'shift-update', name: 'Shift update', description: 'd', steps: [],
  codeUnits: [
    { id: 'cu-svc', service: 'skello-app', kind: 'service', label: 'UpdateService', path: 'app/services/update_service.rb' },
    { id: 'cu-cb', service: 'skello-app', kind: 'model-callback', label: 'Shift callbacks', path: 'app/models/concerns/shifts/callbacks_concern.rb' },
    { id: 'cu-job', service: 'skello-app', kind: 'job', label: 'ShiftCallbackJob', path: 'app/jobs/shift_callback_job.rb' },
    { id: 'cu-ghost', service: 'skello-app', kind: 'job', label: 'GhostJob', path: 'app/jobs/ghost_job.rb' },
    { id: 'cu-other', service: 'skello-app', kind: 'service', label: 'Other', path: 'app/services/other.rb' },
  ],
  infraNodes: [{ id: 'pg', type: 'postgresql', label: 'shifts', resources: [t('shifts'), t('predicted_shifts')] }],
  codeEdges: [
    { from: 'cu-svc', to: 'pg', crud: ['update'] },
    { from: 'cu-cb', to: 'cu-job' },
    { from: 'cu-cb', to: 'cu-ghost' },
    { from: 'cu-cb', to: 'pg', crud: ['create'] },
    { from: 'cu-other', to: 'pg', crud: ['create'] },
  ],
})

describe('flowListeners', () => {
  it('links a unit to the listeners its write site runs, and falls back to the table event, labelled', () => {
    expect(flowListeners(flow, SURFACE).map(l => [l.unit, l.table, l.basis, l.grade, l.listeners.length])).toEqual([
      ['cu-svc', t('shifts'), 'write-site', 'text', 4],
      ['cu-other', t('shifts'), 'table-event', 'text', 4],
    ])
  })
})

describe('flowListenerDrift', () => {
  it('reports fired effects the callback units do not draw, and drawn edges nothing fired backs', () => {
    expect(flowListenerDrift(flow, SURFACE).map(f => [f.kind, f.detail])).toEqual([
      ['flow-listener-missing', 'shifts.before_save.set_poste writes memberships — not drawn from a model-callback unit'],
      ['flow-listener-unsupported', 'cu-ghost (app/jobs/ghost_job.rb) is drawn from a model-callback unit; no listener the flow fires enqueues it'],
    ])
  })
  it('compares nothing for a flow without a model-callback unit', () => {
    expect(flowListenerDrift({ ...flow, codeUnits: (flow.codeUnits ?? []).filter(u => u.kind !== 'model-callback') }, SURFACE)).toEqual([])
  })
})

describe('listenerMetrics', () => {
  it('counts listeners, reachable tables, async listeners, bypassing writes and cycles per table', () => {
    const m = listenerMetrics(SURFACE)
    expect(m.get(t('shifts'))).toEqual({ listeners: 4, alsoChanges: 3, async: 1, bypassing: 1, onCycle: false })
    expect(m.get(t('a'))?.onCycle).toBe(true)
  })
})
