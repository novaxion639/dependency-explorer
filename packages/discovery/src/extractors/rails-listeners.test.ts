import { describe, it, expect } from 'vitest'
import type { ListenerEffect } from '@dependency-explorer/schema'
import { buildModelIndex } from './rails-model-index'
import { effectsOf, listenerContext } from './rails-listeners'
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
