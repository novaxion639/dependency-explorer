import { ConnectivityMapSchema, ListenerSurfaceSchema, ResourceSurfaceSchema, ServiceFlowSchema } from '@dependency-explorer/data'
import type { Dataset } from '../utils/dataset'

const MONOLITH = 'skello-app'
const PINS = { [MONOLITH]: 'd03882653ab851485111316d4a3d181d793cfba2' }
const SHIFTS = 'pg:skello_production.shifts'
const UPDATE_SERVICE = 'app/services/v3/shifts/update_service.rb'

const unit = (id: string, kind: string, label: string, path?: string) => ({ id, service: MONOLITH, kind, label, path })
const chapter = (title: string, refs: string[]) => ({ title, summary: title, refs })

export const shiftCreationFlow = ServiceFlowSchema.parse({
  id: 'shift-creation',
  name: 'Shift Creation',
  description: 'A planner creates a shift on the planning page. The monolith persists it inside a transaction.',
  trigger: { actor: 'manager' },
  primaryArea: 'planning',
  chapters: [chapter('A manager saves a shift', ['skello-app-front', 'cu-shifts-controller']), chapter('The shift is written', ['cu-create-service', 'pg-skello-shifts'])],
  steps: [{ from: 'skello-app-front', to: MONOLITH, action: 'POST /v3/api/plannings/shifts' }],
  codeUnits: [
    unit('cu-shifts-controller', 'controller', 'V3::Api::Plannings::ShiftsController#create', 'app/controllers/v3/api/plannings/shifts_controller.rb'),
    unit('cu-create-service', 'service', 'V3::Shifts::CreateService', 'app/services/v3/shifts/create_service.rb'),
    unit('cu-activity-job', 'job', 'ActivityJob', 'app/jobs/activity_job.rb'),
  ],
  infraNodes: [{ id: 'pg-skello-shifts', type: 'postgresql', label: 'shifts', resources: [SHIFTS] }],
  codeEdges: [
    { from: 'cu-shifts-controller', to: 'cu-create-service', label: '.run!', mode: 'sync' },
    { from: 'cu-create-service', to: 'pg-skello-shifts', mode: 'sync', crud: ['create'] },
    { from: 'cu-create-service', to: 'cu-activity-job', mode: 'async-job', condition: 'absence shifts only' },
  ],
  branches: [{ id: 'locked-day', at: 'cu-create-service', when: 'locked day', outcome: 'forbidden', status: 403, evidence: { literal: ':forbidden' } }],
})

export const shiftUpdateFlow = ServiceFlowSchema.parse({
  id: 'shift-update',
  name: 'Shift Update',
  description: 'A planner edits a shift.',
  trigger: { actor: 'manager' },
  primaryArea: 'planning',
  chapters: [chapter('The shift is saved', ['cu-upd-service'])],
  steps: [],
  codeUnits: [
    unit('cu-upd-controller', 'controller', 'V3::Api::Plannings::ShiftsController#update', 'app/controllers/v3/api/plannings/shifts_controller.rb'),
    unit('cu-upd-service', 'service', 'V3::Shifts::UpdateService', UPDATE_SERVICE),
    unit('cu-upd-callbacks', 'model-callback', 'Shift callbacks', 'app/models/shift.rb'),
    unit('cu-upd-data-job', 'job', 'Shifts::ShiftDataUpdaterJob', 'app/jobs/shifts/shift_data_updater_job.rb'),
  ],
  infraNodes: [{ id: 'pg-skello-shifts-upd', type: 'postgresql', label: 'shifts', resources: [SHIFTS, 'pg:skello_production.shift_replacements'] }],
  codeEdges: [
    { from: 'cu-upd-controller', to: 'cu-upd-service', mode: 'sync' },
    { from: 'cu-upd-callbacks', to: 'cu-upd-data-job', mode: 'async-job' },
  ],
})

export const selfServeSignupFlow = ServiceFlowSchema.parse({
  id: 'self-serve-signup',
  name: 'Self-serve Signup',
  description: 'A prospect signs up.',
  trigger: { actor: 'prospect' },
  primaryArea: 'onboarding',
  chapters: [chapter('The prospect is saved', ['cu-ss-prospect'])],
  steps: [],
  codeUnits: [unit('cu-ss-prospect', 'service', 'Signup::ProspectService', 'app/services/signup/prospect_service.rb')],
  infraNodes: [{ id: 'pg-skello-signup', type: 'postgresql', label: 'signup', resources: ['pg:skello_production.prospects'] }],
  codeEdges: [{ from: 'cu-ss-prospect', to: 'pg-skello-signup', mode: 'sync', crud: ['create'] }],
})

const afterCommit = (table: string, model: string, method: string, effects: unknown[]) => ({
  id: `${table.split('.').pop() ?? table}.after_commit.${method}`, table, kind: 'callback', hook: 'after_commit', method,
  events: ['create', 'update', 'destroy'], phase: 'commit', declaredAt: { file: `app/models/${model}.rb`, line: 197 }, effects, grade: 'code',
})

export const flowListenerSurface = ListenerSurfaceSchema.parse({
  listeners: [
    afterCommit(SHIFTS, 'shift', 'update_paid_leaves', []),
    afterCommit(SHIFTS, 'shift', 'manage_predicted_shift', [{
      kind: 'writes', target: 'pg:skello_production.predicted_shifts', mode: 'sync', events: ['create'], runs: 'all',
      at: { file: 'app/models/concerns/shifts/callbacks_concern.rb', line: 80 }, grade: 'graph',
    }]),
    afterCommit('pg:skello_production.prospects', 'prospect', 'send_activation_email', []),
  ],
  writeSites: [
    { table: SHIFTS, file: UPDATE_SERVICE, line: 149, call: 'update!', events: ['update'], runs: 'all', grade: 'text' },
    { table: 'pg:skello_production.shift_replacements', file: UPDATE_SERVICE, line: 241, call: 'update_all', events: ['update'], runs: 'none', grade: 'constant' },
  ],
  pins: PINS,
})

export const flowDataset: Dataset = {
  map: ConnectivityMapSchema.parse({
    services: [{ name: MONOLITH, type: 'rails-monolith', description: 'The monolith', endpoints: [], repoUrl: 'https://github.com/skelloapp/skello-app' }],
    connections: [],
    flows: [shiftCreationFlow, shiftUpdateFlow, selfServeSignupFlow],
  }),
  resources: ResourceSurfaceSchema.parse({ resources: [], relations: [], pins: PINS }),
  listeners: flowListenerSurface,
  relations: [],
  notes: {},
}
