import { describe, it, expect } from 'vitest'
import type { ListenerEffect } from '@dependency-explorer/schema'
import { buildModelIndex } from './rails-model-index'
import { callbackListeners, effectsOf, listenerContext } from './rails-listeners'
import { FIXTURE_TABLES, fixtureModels, fixtureRead } from './__fixtures__/listeners'

const index = buildModelIndex(fixtureModels, fixtureRead)
const shift = index.find(e => e.className === 'Shift')
const ctx = () => listenerContext(index, fixtureRead, null, FIXTURE_TABLES)
const brief = (effects: ListenerEffect[]) => effects.map(e => [e.kind, e.target, e.mode, e.via ?? '-', e.runs ?? '-', e.grade])

describe('effectsOf', () => {
  it('follows an enqueue into the job and one call level into a model class method that writes through raw SQL', () => {
    const span = shift?.methods.get('set_weekly_option_not_up_to_date')
    expect(span && shift ? brief(effectsOf(span, shift, ctx())) : []).toEqual([
      ['enqueues', 'ShiftCallbackJob', 'async-job', '-', '-', 'constant'],
      ['calls', 'WeeklyOption.upsert_employee_change!', 'async-job', 'ShiftCallbackJob', '-', 'constant'],
      ['writes', 'pg:skello_production.weekly_options', 'async-job', 'ShiftCallbackJob → WeeklyOption.upsert_employee_change!', 'none', 'constant'],
    ])
  })
  it('records a direct class-level write through safe navigation', () => {
    const span = shift?.methods.get('set_new_default_poste')
    expect(span && shift ? brief(effectsOf(span, shift, ctx())) : []).toEqual([
      ['writes', 'pg:skello_production.memberships', 'sync', '-', 'all', 'constant'],
    ])
  })
  it('stores the callee file of an enqueue', () => {
    const span = shift?.methods.get('update_paid_leaves')
    const effects = span && shift ? effectsOf(span, shift, ctx()) : []
    expect(effects[0]).toMatchObject({ kind: 'enqueues', targetFile: 'app/jobs/update_paid_leaves_counter_job.rb', at: { file: 'app/models/concerns/shifts/callbacks_concern.rb', line: 12 } })
    expect(brief(effects).slice(1)).toEqual([
      ['calls', 'PaidLeavesCounter.update_days!', 'async-job', 'UpdatePaidLeavesCounterJob', '-', 'constant'],
      ['writes', 'pg:skello_production.paid_leaves_counters', 'async-job', 'UpdatePaidLeavesCounterJob → PaidLeavesCounter.update_days!', 'none', 'constant'],
    ])
  })
  it('upgrades an enqueue to graph when the pinned graph reaches the job within two hops', () => {
    const graph = { builtAt: 'sha', fileEdges: new Map([['app/models/concerns/shifts/callbacks_concern.rb', new Set(['app/jobs/shift_callback_job.rb'])]]), importEdges: new Map(), classesIn: new Map() }
    const span = shift?.methods.get('set_weekly_option_not_up_to_date')
    const effects = span && shift ? effectsOf(span, shift, listenerContext(index, fixtureRead, graph, FIXTURE_TABLES)) : []
    expect(effects[0]?.grade).toBe('graph')
  })
})

describe('service entry matching', () => {
  const shop = index.find(e => e.className === 'Shop')
  const syncPunchWith = (body: string) => {
    const span = shop?.methods.get('sync_punch')
    return span ? { ...span, body, raw: body } : null
  }
  it('calls the service on .call and ignores .callbacks', () => {
    const call = syncPunchWith('    Microservices::Punch::SettingService.new(self).call')
    const callbacks = syncPunchWith('    Microservices::Punch::SettingService.new(self).callbacks')
    expect(call && shop ? effectsOf(call, shop, ctx()).map(e => [e.kind, e.target, e.targetFile]) : []).toEqual([
      ['calls', 'Microservices::Punch::SettingService', 'app/services/microservices/punch/setting_service.rb'],
    ])
    expect(callbacks && shop ? effectsOf(callbacks, shop, ctx()) : []).toEqual([])
  })
  it('still matches .run! on a service entry', () => {
    const run = syncPunchWith('    Microservices::Punch::SettingService.new(self).run!')
    expect(run && shop ? effectsOf(run, shop, ctx()).map(e => e.target) : []).toEqual(['Microservices::Punch::SettingService'])
  })
})

describe('callbackListeners', () => {
  const byClass = (cls: string) => index.find(e => e.className === cls)
  it('emits one listener per symbol with the body in the concern', () => {
    const c = ctx()
    const shiftEntry = byClass('Shift')
    const listeners = shiftEntry ? callbackListeners(shiftEntry, c) : []
    expect(listeners.map(l => [l.id, l.phase, l.events.join(','), l.definedAt?.file])).toEqual([
      ['shifts.before_save.set_new_default_poste', 'save', 'create,update', 'app/models/concerns/shifts/callbacks_concern.rb'],
      ['shifts.after_commit.set_weekly_option_not_up_to_date', 'commit', 'create,update,destroy', 'app/models/concerns/shifts/callbacks_concern.rb'],
      ['shifts.after_commit.update_paid_leaves', 'commit', 'create,update,destroy', 'app/models/concerns/shifts/callbacks_concern.rb'],
    ])
    expect(listeners[0]?.declaredAt).toEqual({ file: 'app/models/shift.rb', line: 5 })
  })
  it('keeps on: and if: verbatim, reads blocks, attributes included-block callbacks and reports unresolved symbols', () => {
    const c = ctx()
    const shopEntry = byClass('Shop')
    const listeners = shopEntry ? callbackListeners(shopEntry, c) : []
    expect(listeners.map(l => [l.id, l.events.join(','), l.condition ?? '-'])).toEqual([
      ['shops.before_create.ensure_authentication_token', 'create', '-'],
      ['shops.after_commit.sync_punch', 'create,update', 'if: -> { saved_change_to_name? }'],
      ['shops.before_validation.missing_method', 'create,update', '-'],
      ['shops.after_save.block@6', 'create,update', '-'],
    ])
    expect(listeners[3]?.effects.map(e => [e.kind, e.target, e.runs])).toEqual([['writes', 'pg:skello_production.organisations', 'none']])
    expect(c.findings).toEqual([{ kind: 'unresolved-callback', subject: 'Shop#missing_method', detail: 'app/models/shop.rb:5 names a method neither Shop nor its included modules define' }])
  })
})
