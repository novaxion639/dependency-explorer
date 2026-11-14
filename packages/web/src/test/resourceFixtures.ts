import { ConnectivityMapSchema, ListenerSurfaceSchema, ResourceSurfaceSchema } from '@dependency-explorer/data'
import type { Dataset } from '../utils/dataset'

const DB = 'pg:skello_production'
const SHIFTS = `${DB}.shifts`
const BILLING_INFOS = `${DB}.billing_infos`
const ACTIVITY_LOG_QUEUE = 'sqs:createActivityLogJob'
const pins = { 'skello-app': '0123456789abcdef0123456789abcdef01234567' }

const service = (name: string, type: string, databases: object[] = []) => ({ name, type, description: name, endpoints: [], databases })
const connection = (from: string, to: string, communicationType: 'sync' | 'async', protocol: string) => ({
  from, to, sdkPackage: `${to}-sdk`, description: `${from} calls ${to}`, usedEndpoints: [], communicationType, protocol, authType: 'internal',
})
const area = (id: string, kind: 'product' | 'platform', repo: string) => ({
  id, name: id, description: id, kind, color: '#336699', codeLocations: [{ repo, platform: 'backend', globs: ['**'] }], readingPath: [], glossary: [],
})
const resource = (id: string, kind: string, store: string, name: string, extra: object = {}) => ({ id, kind, store, name, evidence: ['skello-app:db/schema.rb'], ...extra })
const at = (file: string, line: number) => ({ file, line })

const map = ConnectivityMapSchema.parse({
  services: [
    service('skello-app', 'rails-monolith'),
    service('skello-app-front', 'vue-frontend'),
    service('svc-requests', 'typescript-microservice'),
    service('svc-events', 'typescript-microservice', [{ type: 'mongodb', name: 'events', description: 'event store' }]),
    service('svc-communications-v2', 'typescript-microservice'),
  ],
  connections: [
    connection('skello-app', 'svc-requests', 'sync', 'rest'),
    connection('skello-app-front', 'skello-app', 'sync', 'rest'),
    connection('svc-events', 'svc-requests', 'async', 'sqs'),
    connection('svc-requests', 'svc-communications-v2', 'async', 'sqs'),
  ],
  flows: [{
    id: 'request-approval', name: 'Request Approval', description: 'A manager approves a request', trigger: { actor: 'manager' }, primaryArea: 'requests',
    steps: [{ from: 'skello-app', to: 'svc-requests', action: 'approve the request' }],
    chapters: [{ title: 'Approve', summary: 'The manager approves', refs: ['skello-app'] }],
  }],
  areas: [area('requests', 'product', 'svc-requests'), area('events', 'platform', 'svc-events')],
})

const resources = ResourceSurfaceSchema.parse({
  resources: [
    resource(SHIFTS, 'table', 'postgresql', 'shifts', { owner: 'skello-app' }),
    resource(`${DB}.weekly_options`, 'table', 'postgresql', 'weekly_options', { owner: 'skello-app' }),
    resource(BILLING_INFOS, 'table', 'postgresql', 'billing_infos', { owner: 'skello-app' }),
    resource(DB, 'database', 'postgresql', 'skello_production'),
    resource('ddb:svcDocuments-eSignature-V2', 'table', 'dynamodb', 'svcDocuments-eSignature-V2', { owner: 'svc-documents-esignature' }),
    resource(ACTIVITY_LOG_QUEUE, 'queue', 'sqs', 'createActivityLogJob', { owner: 'svc-requests' }),
    resource(`${ACTIVITY_LOG_QUEUE}-dlq`, 'queue', 'sqs', 'createActivityLogJob-dlq', { owner: 'svc-requests' }),
    resource('kinesis:skelloapp-bus', 'stream', 'kinesis', 'skelloapp-bus'),
    resource('mongodb:events', 'table', 'mongodb', 'events', { evidence: ['dataset:svc-events'] }),
    resource('redis:sessions', 'database', 'redis', 'sessions'),
    resource('s3:skello-exports', 'bucket', 's3', 'skello-exports'),
    resource('sns:shift-events', 'topic', 'sns', 'shift-events'),
  ],
  relations: [
    { resource: SHIFTS, relation: 'writes', service: 'skello-app', file: 'app/models/shift.rb', grade: 'code' },
    { resource: SHIFTS, relation: 'reads', service: 'svc-shifts', file: 'src/repositories/shift.repository.ts', grade: 'code' },
    { resource: SHIFTS, relation: 'feeds', service: 'skello-app', target: 'kinesis:skelloapp-bus', grade: 'config' },
    { resource: ACTIVITY_LOG_QUEUE, relation: 'produces', service: 'svc-requests', file: 'src/jobs/activity-log.ts', grade: 'code' },
    { resource: ACTIVITY_LOG_QUEUE, relation: 'dead-letters-to', service: 'svc-requests', target: `${ACTIVITY_LOG_QUEUE}-dlq`, grade: 'config' },
  ],
  pins,
})

const listeners = ListenerSurfaceSchema.parse({
  listeners: [
    {
      id: 'shifts.after_commit.update_paid_leaves', table: SHIFTS, kind: 'callback', hook: 'after_commit', method: 'update_paid_leaves',
      events: ['create', 'update', 'destroy'], phase: 'commit', declaredAt: at('app/models/shift.rb', 196), grade: 'code',
      effects: [{ kind: 'writes', target: `${DB}.weekly_options`, mode: 'async-job', events: ['update'], at: at('app/jobs/update_paid_leaves_job.rb', 12), grade: 'constant' }],
    },
    {
      id: 'shifts.dependent.shift_swaps', table: SHIFTS, kind: 'cascade', hook: 'dependent: :delete_all',
      events: ['destroy'], phase: 'event', declaredAt: at('app/models/shift.rb', 20), grade: 'code',
      effects: [{ kind: 'writes', target: `${DB}.shift_swaps`, mode: 'sync', events: ['destroy'], at: at('app/models/shift.rb', 20), grade: 'graph' }],
    },
    {
      id: 'billing_infos.after_destroy.archive_invoices', table: BILLING_INFOS, kind: 'callback', hook: 'after_destroy', method: 'archive_invoices',
      events: ['destroy'], phase: 'save', declaredAt: at('app/models/billing_info.rb', 8), grade: 'code',
      effects: [{ kind: 'writes', target: `${DB}.invoices`, mode: 'sync', events: ['update'], at: at('app/models/billing_info.rb', 30), grade: 'graph' }],
    },
  ],
  writeSites: [
    { table: SHIFTS, file: 'app/services/shifts/bulk_update.rb', line: 14, call: 'Shift.update_all', events: ['update'], runs: 'none', grade: 'constant' },
  ],
  pins,
})

export const dataset: Dataset = { map, resources, listeners, relations: resources.relations, notes: {} }
