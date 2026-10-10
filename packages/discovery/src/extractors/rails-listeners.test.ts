import { describe, it, expect } from 'vitest'
import type { ListenerEffect } from '@dependency-explorer/schema'
import { buildModelIndex } from './rails-model-index'
import type { Read } from '../code-wiring'
import { associationListeners, callbackListeners, effectsOf, extractListeners, gemListeners, joinTableName, listenerContext } from './rails-listeners'
import { parseModelFile } from './rails-schema'
import { FIXTURE_FILES, FIXTURE_TABLES, fixtureModels, fixtureRead } from './__fixtures__/listeners'

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

describe('gem-provided callback methods', () => {
  const run = (source: string) => {
    const { entries, c } = miniContext({ 'app/models/place.rb': source }, ['places'])
    const [place] = entries
    return { listeners: place ? callbackListeners(place, c) : [], findings: c.findings }
  }
  it('keeps a callback on a method the geocoder macro defines, without a finding', () => {
    const { listeners, findings } = run('class Place < ApplicationRecord\n  geocoded_by :address\n  before_save :geocode\nend\n')
    expect(listeners.map(l => [l.id, l.definedAt ?? null, l.effects])).toEqual([['places.before_save.geocode', null, []]])
    expect(findings).toEqual([])
  })
  it('keeps reverse_geocode under reverse_geocoded_by', () => {
    const { listeners, findings } = run('class Place < ApplicationRecord\n  reverse_geocoded_by :latitude, :longitude\n  after_validation :reverse_geocode\nend\n')
    expect(listeners.map(l => l.id)).toEqual(['places.after_validation.reverse_geocode'])
    expect(findings).toEqual([])
  })
  it('still reports the callback when no macro declares the method', () => {
    const { listeners, findings } = run('class Place < ApplicationRecord\n  before_save :geocode\nend\n')
    expect(listeners.map(l => l.id)).toEqual(['places.before_save.geocode'])
    expect(findings.map(f => [f.kind, f.subject])).toEqual([['unresolved-callback', 'Place#geocode']])
  })
})

describe('associationListeners', () => {
  const of = (cls: string) => associationListeners(index.find(e => e.className === cls) ?? index[0], ctx())
  it('reads dependent: as a destroy cascade with the child write runs', () => {
    expect(of('Shift').map(l => [l.id, l.hook, l.effects[0]?.target, l.effects[0]?.runs, l.effects[0]?.events?.join(',')])).toEqual([
      ['shifts.dependent.shift_swaps', 'dependent: :delete_all', 'pg:skello_production.shift_swaps', 'none', 'destroy'],
      ['shifts.dependent.badging', 'dependent: :nullify', 'pg:skello_production.badgings', 'none', 'update'],
    ])
    expect(of('Poste').map(l => [l.id, l.effects[0]?.runs])).toEqual([['postes.dependent.shifts', 'all']])
  })
  it('reads belongs_to touch: true as a touch listener on the child writing the parent', () => {
    expect(of('Contract').map(l => [l.id, l.kind, l.phase, l.effects[0]?.target, l.effects[0]?.runs])).toEqual([
      ['contracts.touch.user', 'touch', 'event', 'pg:skello_production.users', 'touch'],
    ])
  })
})

describe('gemListeners', () => {
  it('maps known macros, ignores attribute macros and anything inside a method body, and reports unknown ones', () => {
    const c = ctx()
    const all = index.flatMap(e => gemListeners(e, c))
    expect(all.map(l => [l.id, l.grade, l.effects.map(e => `${e.target}:${e.runs}`).join(' ')])).toEqual([
      ['shops.multisearchable', 'config', 'pg:skello_production.pg_search_documents:all pg:skello_production.pg_search_documents:none'],
      ['users.has_secure_token', 'config', ''],
      ['cluster_nodes.has_ancestry', 'config', 'pg:skello_production.cluster_nodes:all'],
      ['night_hours_maj_slices.acts_as_list', 'config', 'pg:skello_production.night_hours_maj_slices:none'],
    ])
    expect(c.findings).toEqual([{ kind: 'unknown-gem-macro', subject: 'Organisation.acts_as_paranoid', detail: 'app/models/organisation.rb:2 — not a Rails association and not in KNOWN_GEM_LISTENERS' }])
  })
})

const miniContext = (files: Record<string, string>, tables: string[]) => {
  const read: Read = p => files[p] ?? null
  const models = Object.keys(files).flatMap(f => parseModelFile(f, files[f] ?? '') ?? [])
  const entries = buildModelIndex(models, read)
  return { entries, c: listenerContext(entries, read, null, tables) }
}

describe('joinTableName', () => {
  it('sorts the table names and joins them with an underscore', () => {
    expect(joinTableName('weekly_options', 'postes')).toBe('postes_weekly_options')
  })
  it('collapses a shared prefix the way ActiveRecord does', () => {
    expect(joinTableName('user_roles', 'user_groups')).toBe('user_groups_roles')
  })
})

describe('habtm cascade', () => {
  const habtm = (declaration: string, tables: string[]) => {
    const { entries, c } = miniContext({
      'app/models/weekly_option.rb': ['class WeeklyOption < ApplicationRecord', `  ${declaration}`, 'end'].join('\n'),
      'app/models/poste.rb': 'class Poste < ApplicationRecord\nend',
    }, tables)
    const entry = entries.find(e => e.className === 'WeeklyOption')
    return entry ? associationListeners(entry, c).map(l => [l.id, l.kind, l.effects[0]?.target, l.effects[0]?.runs, l.effects[0]?.events?.join(',')]) : []
  }
  it('targets the ActiveRecord default join table when it is in tables', () => {
    expect(habtm("has_and_belongs_to_many :visible_absences, class_name: 'Poste'", ['postes', 'postes_weekly_options', 'weekly_options'])).toEqual([
      ['weekly_options.habtm.visible_absences', 'cascade', 'pg:skello_production.postes_weekly_options', 'none', 'destroy'],
    ])
  })
  it('targets an explicit join_table', () => {
    expect(habtm("has_and_belongs_to_many :visible_absences, class_name: 'Poste', join_table: 'custom_join'", ['custom_join', 'postes', 'weekly_options'])).toEqual([
      ['weekly_options.habtm.visible_absences', 'cascade', 'pg:skello_production.custom_join', 'none', 'destroy'],
    ])
  })
  it('collapses a shared table prefix in the default join table', () => {
    const { entries, c } = miniContext({
      'app/models/user_role.rb': 'class UserRole < ApplicationRecord\n  has_and_belongs_to_many :user_groups, class_name: \'UserGroup\'\nend',
      'app/models/user_group.rb': 'class UserGroup < ApplicationRecord\nend',
    }, ['user_groups', 'user_groups_roles', 'user_roles'])
    const entry = entries.find(e => e.className === 'UserRole')
    expect(entry ? associationListeners(entry, c).map(l => [l.id, l.effects[0]?.target]) : []).toEqual([
      ['user_roles.habtm.user_groups', 'pg:skello_production.user_groups_roles'],
    ])
  })
  it('emits no listener when the join table is not in tables', () => {
    expect(habtm("has_and_belongs_to_many :visible_absences, class_name: 'Poste'", ['postes', 'weekly_options'])).toEqual([])
  })
})

describe('has_ancestry descendants', () => {
  const ancestryEffects = (declaration: string) => {
    const { entries, c } = miniContext({
      'app/models/cluster_node.rb': ['class ClusterNode < ApplicationRecord', `  ${declaration}`, 'end'].join('\n'),
    }, ['cluster_nodes'])
    const entry = entries.find(e => e.className === 'ClusterNode')
    return entry ? gemListeners(entry, c).flatMap(l => l.effects.map(e => [e.target, e.events?.join(','), e.runs])) : []
  }
  it('destroys descendants with the default strategy', () => {
    expect(ancestryEffects('has_ancestry')).toEqual([
      ['pg:skello_production.cluster_nodes', 'update', 'all'],
      ['pg:skello_production.cluster_nodes', 'destroy', 'all'],
    ])
  })
  it('only updates when orphan_strategy is adopt', () => {
    expect(ancestryEffects('has_ancestry orphan_strategy: :adopt')).toEqual([
      ['pg:skello_production.cluster_nodes', 'update', 'all'],
    ])
  })
})

describe('dependent cascade table gate', () => {
  const dependent = (tables: string[]) => {
    const { entries, c } = miniContext({
      'app/models/shift.rb': 'class Shift < ApplicationRecord\n  has_many :shift_swaps, dependent: :destroy\nend',
      'app/models/shift_swap.rb': 'class ShiftSwap < ApplicationRecord\nend',
    }, tables)
    const entry = entries.find(e => e.className === 'Shift')
    return entry ? associationListeners(entry, c).map(l => l.id) : []
  }
  it('emits no listener when the child table is not in tables', () => {
    expect(dependent(['shifts'])).toEqual([])
  })
  it('emits the listener when the child table is in tables', () => {
    expect(dependent(['shifts', 'shift_swaps'])).toEqual(['shifts.dependent.shift_swaps'])
  })
})

describe('belongs_to touch table gate', () => {
  const touch = (tables: string[]) => {
    const { entries, c } = miniContext({
      'app/models/contract.rb': 'class Contract < ApplicationRecord\n  belongs_to :user, touch: true\nend',
      'app/models/user.rb': 'class User < ApplicationRecord\nend',
    }, tables)
    const entry = entries.find(e => e.className === 'Contract')
    return entry ? associationListeners(entry, c).map(l => l.id) : []
  }
  it('emits no listener when the parent table is not in tables', () => {
    expect(touch(['contracts'])).toEqual([])
  })
  it('emits the listener when the parent table is in tables', () => {
    expect(touch(['contracts', 'users'])).toEqual(['contracts.touch.user'])
  })
})

describe('extractListeners', () => {
  const files = Object.entries(FIXTURE_FILES).map(([file, source]) => ({ file, source }))
  const result = extractListeners({ models: fixtureModels, tables: FIXTURE_TABLES, files, read: fixtureRead, graph: null })
  const sitesIn = (file: string) => result.writeSites.filter(s => s.file === file).map(s => [s.table, s.call, s.runs, s.grade, (s.fires ?? []).join(' ')])

  it('classifies a callback-skipping import and a hand-fired helper in a service', () => {
    expect(sitesIn('app/services/v3/shifts/bulk_create_service.rb')).toEqual([
      ['pg:skello_production.shifts', 'import!', 'none', 'constant', ''],
      ['pg:skello_production.shifts', 'run_generic_callbacks!', 'subset', 'text', 'shifts.after_commit.update_paid_leaves shifts.after_commit.set_weekly_option_not_up_to_date'],
    ])
  })
  it('expands run_callbacks(:commit) inside a helper to every commit listener of the model', () => {
    expect(sitesIn('app/controllers/api/v2/shifts_controller.rb')).toEqual([
      ['pg:skello_production.shifts', 'run_shift_callbacks!', 'subset', 'text', 'shifts.after_commit.set_weekly_option_not_up_to_date shifts.after_commit.update_paid_leaves'],
    ])
  })
  it('never records a helper body or an unresolvable receiver as a write site', () => {
    expect(sitesIn('app/models/concerns/shifts/callbacks_concern.rb').map(s => s[1])).toEqual(['update!'])
  })
  it('collects every listener kind and finding', () => {
    expect(new Set(result.listeners.map(l => l.kind))).toEqual(new Set(['callback', 'cascade', 'touch', 'gem']))
    expect(result.findings.map(f => f.kind).sort()).toEqual(['unknown-gem-macro', 'unresolved-callback'])
  })
})

const extractFilesFor = (sources: Record<string, string>) => {
  const models = Object.keys(sources).flatMap(f => parseModelFile(f, sources[f] ?? '') ?? [])
  return extractListeners({
    models,
    tables: models.map(m => m.table),
    files: Object.entries(sources).map(([file, source]) => ({ file, source })),
    read: p => sources[p] ?? null,
    graph: null,
  })
}

describe('extractListeners on a mini model', () => {
  const extract = (model: string) => extractFilesFor({ 'app/models/shift.rb': model })
  it('reports one finding when a def behind two callback declarations enqueues an unresolvable job', () => {
    const { findings } = extract([
      'class Shift < ApplicationRecord',
      '  after_commit :a, on: :create',
      '  after_commit :a, on: :update',
      '  def a',
      '    GhostJob.perform_later(id)',
      '  end',
      'end',
    ].join('\n'))
    expect(findings.filter(f => f.kind === 'unresolved-job')).toHaveLength(1)
  })
  it('suffixes a later duplicate listener id with the declaring file and line', () => {
    const { listeners } = extract([
      'class Shift < ApplicationRecord',
      '  after_commit :foo, on: :create',
      '  after_commit :foo, on: :update',
      '  def foo',
      '  end',
      'end',
    ].join('\n'))
    expect(listeners.map(l => [l.id, l.events.join(',')])).toEqual([
      ['shifts.after_commit.foo', 'create'],
      ['shifts.after_commit.foo@shift.rb:3', 'update'],
    ])
  })
})

describe('standalone run_callbacks sites', () => {
  const fires = (model: string, call: string) => {
    const { writeSites } = extractFilesFor({
      'app/models/shift.rb': model,
      'app/services/runner.rb': ['class Runner', '  def run', `    ${call}`, '  end', 'end'].join('\n'),
    })
    return writeSites.filter(s => s.file === 'app/services/runner.rb').map(s => [s.table, s.call, s.runs, s.grade, s.fires])
  }
  const model = (...callbacks: string[]) => ['class Shift < ApplicationRecord', ...callbacks.map(c => `  ${c}`), '  def a; end', '  def b; end', '  def c; end', '  def d; end', '  def e; end', 'end'].join('\n')

  it('fires only the save chain listeners for run_callbacks(:save)', () => {
    expect(fires(model('before_save :a', 'after_commit :b'), 'shift.run_callbacks(:save) { false }')).toEqual([
      ['pg:skello_production.shifts', 'run_callbacks(:save)', 'subset', 'text', ['shifts.before_save.a']],
    ])
  })
  it('fires the before and after update listeners but not the save chain for run_callbacks(:update)', () => {
    expect(fires(model('before_update :c', 'after_update :d', 'before_save :e'), 'shift.run_callbacks(:update) { false }')).toEqual([
      ['pg:skello_production.shifts', 'run_callbacks(:update)', 'subset', 'text', ['shifts.before_update.c', 'shifts.after_update.d']],
    ])
  })
  it('keeps a subset site with no fires when the model has no listener for the chain', () => {
    expect(fires(model('before_save :a'), 'shift.run_callbacks(:create) { false }')).toEqual([
      ['pg:skello_production.shifts', 'run_callbacks(:create)', 'subset', 'text', []],
    ])
  })
})

describe('hand-fire helper attribution', () => {
  const sites = (call: string) => {
    const { writeSites } = extractFilesFor({
      'app/models/shift.rb': ['class Shift < ApplicationRecord', '  after_commit :a', '  def a; end', '  def run_x!', '    a', '  end', 'end'].join('\n'),
      'app/models/poste.rb': 'class Poste < ApplicationRecord\nend',
      'app/services/runner.rb': ['class Runner', '  def run', `    ${call}`, '  end', 'end'].join('\n'),
    })
    return writeSites.filter(s => s.file === 'app/services/runner.rb').map(s => [s.table, s.call, s.fires])
  }
  it('attributes a helper call to the model of its receiver', () => {
    expect(sites('shift.run_x!')).toEqual([['pg:skello_production.shifts', 'run_x!', ['shifts.after_commit.a']]])
  })
  it('does not attribute a helper call whose receiver resolves to another model', () => {
    expect(sites('poste.run_x!')).toEqual([])
  })
  it('attributes a helper call on an unresolvable receiver to the only model defining it', () => {
    expect(sites('thing.run_x!')).toEqual([['pg:skello_production.shifts', 'run_x!', ['shifts.after_commit.a']]])
  })
})

describe('extractListeners file filter', () => {
  it('ignores sources under spec/ and test/ directories', () => {
    const write = 'Shift.update_all(a: 1)'
    const { writeSites } = extractFilesFor({
      'app/models/shift.rb': 'class Shift < ApplicationRecord\nend',
      'app/services/real.rb': write,
      'spec/services/fake.rb': write,
      'test/fake.rb': write,
      'lib/test/fake.rb': write,
      'app/spec/fake.rb': write,
    })
    expect(writeSites.map(s => s.file)).toEqual(['app/services/real.rb'])
  })
})

describe('listener id uniqueness', () => {
  it('keeps every suffixed id unique when duplicates share a file and line', () => {
    const { listeners } = extractFilesFor({
      'app/models/shift.rb': ['class Shift < ApplicationRecord', '  after_commit :foo, :foo, :foo', '  def foo; end', 'end'].join('\n'),
    })
    expect(listeners.map(l => l.id)).toEqual(['shifts.after_commit.foo', 'shifts.after_commit.foo@shift.rb:2', 'shifts.after_commit.foo@shift.rb:2#2'])
  })
})

describe('devise macro', () => {
  it('reads devise as a gem listener on create and update with no effects', () => {
    const { listeners, findings } = extractFilesFor({ 'app/models/user.rb': 'class User < ApplicationRecord\n  devise :database_authenticatable, :recoverable\nend\n' })
    expect(listeners.map(l => [l.id, l.kind, l.phase, l.events.join(','), l.effects.length])).toEqual([['users.devise', 'gem', 'event', 'create,update', 0]])
    expect(findings).toEqual([])
  })
})

describe('deterministic output order', () => {
  const result = extractFilesFor({
    'app/models/shift.rb': ['class Shift < ApplicationRecord', '  multisearchable against: :name', '  after_commit :b', '  def b', '    Badging.create(a: 1)', '  end', 'end'].join('\n'),
    'app/models/badging.rb': ['class Badging < ApplicationRecord', '  after_save :x', '  def x', '  end', 'end'].join('\n'),
    'app/services/z.rb': 'Badging.create(a: 1)\nBadging.update_all(a: 1)',
    'app/services/a.rb': 'Badging.destroy_all\nBadging.create(a: 1)',
  })
  it('sorts listeners by table, then file, then line', () => {
    expect(result.listeners.map(l => [l.id, l.declaredAt.line])).toEqual([
      ['badgings.after_save.x', 2],
      ['shifts.multisearchable', 2],
      ['shifts.after_commit.b', 3],
    ])
  })
  it('sorts write sites by file, then line, then call', () => {
    expect(result.writeSites.map(w => [w.file, w.line, w.call])).toEqual([
      ['app/models/shift.rb', 5, 'create'],
      ['app/services/a.rb', 1, 'destroy_all'],
      ['app/services/a.rb', 2, 'create'],
      ['app/services/z.rb', 1, 'create'],
      ['app/services/z.rb', 2, 'update_all'],
    ])
  })
})
