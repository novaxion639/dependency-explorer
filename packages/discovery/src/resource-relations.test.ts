import { describe, it, expect } from 'vitest'
import { tableWriters, tableRelations, messagingRelations, atlasRelations, dmsRelations, dedupeRelations } from './resource-relations'
import type { ServerlessFacts } from './extractors/serverless'
import { loadRepoGraph } from './code-grades'
import type { Resource } from '@dependency-explorer/schema'

const models = [{ className: 'Shift', file: 'app/models/shift.rb', table: 'shifts', associations: [] }]
const files = [
  { file: 'app/services/create.rb', source: 'Shift.create!(attrs)\n' },
  { file: 'app/services/bulk.rb', source: 'Shift.where(shop_id: id).update_all(deleted: true)\n' },
  { file: 'app/services/commented.rb', source: '# Shift.delete_all\nShift.where(id: 1).first\n' },
  { file: 'app/services/other.rb', source: 'Shifts::Thing.create(x)\nShiftTemplate.create(y)\n' },
]

describe('tableWriters', () => {
  it('finds class-level write calls, including chained scopes, and ignores comments and other classes', () => {
    expect([...(tableWriters(files, models).get('shifts') ?? [])].sort()).toEqual(['app/services/bulk.rb', 'app/services/create.rb'])
  })
})

describe('tableRelations', () => {
  it('lists writers and graph readers once each', () => {
    const graph = loadRepoGraph({
      built_at_commit: 'x',
      nodes: [
        { id: 'm', label: 'Shift', source_file: 'app/models/shift.rb', _callable_class: true },
        { id: 'a', label: 'a', source_file: 'app/services/commented.rb' },
        { id: 'b', label: 'b', source_file: 'app/services/create.rb' },
      ],
      links: [
        { source: 'a', target: 'm', relation: 'calls', confidence: 'EXTRACTED' },
        { source: 'b', target: 'm', relation: 'calls', confidence: 'EXTRACTED' },
      ],
    })
    const shifts: Resource = { id: 'pg:skello_production.shifts', kind: 'table', store: 'postgresql', name: 'shifts', evidence: [], model: { file: 'app/models/shift.rb', className: 'Shift' } }
    const rels = tableRelations([shifts], models, files, graph).map(r => `${r.relation} ${r.file}`)
    expect(rels.sort()).toEqual(['reads app/services/commented.rb', 'writes app/services/bulk.rb', 'writes app/services/create.rb'])
  })
  it('reads only from the scanned files, so specs and migrations are neither readers nor writers', () => {
    const graph = loadRepoGraph({
      built_at_commit: 'x',
      nodes: [
        { id: 'm', label: 'Shift', source_file: 'app/models/shift.rb', _callable_class: true },
        { id: 's', label: 's', source_file: 'spec/models/shift_spec.rb' },
        { id: 'g', label: 'g', source_file: 'db/migrate/20200101_backfill.rb' },
      ],
      links: [
        { source: 's', target: 'm', relation: 'calls', confidence: 'EXTRACTED' },
        { source: 'g', target: 'm', relation: 'calls', confidence: 'EXTRACTED' },
      ],
    })
    const shifts: Resource = { id: 'pg:skello_production.shifts', kind: 'table', store: 'postgresql', name: 'shifts', evidence: [], model: { file: 'app/models/shift.rb', className: 'Shift' } }
    expect(tableRelations([shifts], models, files, graph).filter(r => r.relation === 'reads')).toEqual([])
  })
})


const sls = (over: Partial<ServerlessFacts>): ServerlessFacts => ({
  source: 'static-scan', endpoints: [], queueNames: [], streamConsumers: [], s3Triggers: [], schedules: [],
  ownedResources: [], dlqWirings: [], authorizerNames: [], sqsConsumers: null, ...over,
})

describe('messagingRelations', () => {
  const resources: Resource[] = [
    { id: 'sqs:createActivityLogJob', kind: 'queue', store: 'sqs', name: 'createActivityLogJob', owner: 'svc-events', evidence: [] },
    { id: 'sqs:createActivityLogJobDlq', kind: 'queue', store: 'sqs', name: 'createActivityLogJobDlq', owner: 'svc-events', evidence: [] },
    { id: 'kinesis:skelloapp-bus', kind: 'stream', store: 'kinesis', name: 'skelloapp-bus', evidence: [] },
  ]
  const serverless = new Map([
    ['svc-events', sls({ queueNames: ['createActivityLogJob'], dlqWirings: [{ queue: 'createActivityLogJob', dlq: 'createActivityLogJobDlq', retry: null, via: 'redrive' }] })],
    ['svc-employees', sls({ streamConsumers: [{ stream: 'skelloapp-bus', kind: 'kinesis', raw: 'x' }] })],
  ])
  const sources = new Map([
    ['svc-events', [{ file: 'serverless/functions/queues.ts', source: "events: [{ sqs: { arn: 'x' } }]" }]],
    ['svc-requests', [{ file: 'serverless.ts', source: 'queueUrl: `https://sqs.eu-west-1.amazonaws.com/${accountId}/svcEvents-createActivityLogJob-${awsEnv}`' }, { file: 'src/x.ts', source: 'nothing here' }]],
    ['skello-app-front', [{ file: 'src/env.js', source: 'createActivityLogJob' }]],
  ])

  it('derives consumers, producers and dead-letter wiring', () => {
    const rels = messagingRelations(resources, serverless, sources).map(r => `${r.relation} ${r.resource} ${r.service} ${r.grade}${r.target ? ` → ${r.target}` : ''}`)
    expect(rels.sort()).toEqual([
      'consumes kinesis:skelloapp-bus svc-employees config',
      'consumes sqs:createActivityLogJob svc-events config',
      'dead-letters-to sqs:createActivityLogJob svc-events config → sqs:createActivityLogJobDlq',
      'produces sqs:createActivityLogJob svc-requests config',
    ])
  })
})

describe('messagingRelations literal matching', () => {
  it('matches whole tokens of distinctive names only', () => {
    const resources: Resource[] = [
      { id: 'sns:dispatch', kind: 'topic', store: 'sns', name: 'dispatch', owner: 'svc-requests', evidence: [] },
      { id: 'sqs:mergeShopSqs', kind: 'queue', store: 'sqs', name: 'mergeShopSqs', owner: 'svc-shops', evidence: [] },
    ]
    const sources = new Map([
      ['skello-app', [
        { file: 'app/a.rb', source: 'store.dispatch(action)' },
        { file: 'app/b.rb', source: "queue: 'svcShops-mergeShopSqs-production'" },
        { file: 'app/c.rb', source: 'mergeShopSqsHandler.run' },
      ]],
    ])
    expect(messagingRelations(resources, new Map(), sources).map(r => `${r.relation} ${r.resource} ${r.file}`)).toEqual(['produces sqs:mergeShopSqs app/b.rb'])
  })
})

describe('messagingRelations producer precision', () => {
  const resources: Resource[] = [
    { id: 'sqs:transaction', kind: 'queue', store: 'sqs', name: 'transaction', owner: 'svc-pos', evidence: [] },
    { id: 'kinesis:skelloapp-bus', kind: 'stream', store: 'kinesis', name: 'skelloapp-bus', owner: 'skello-app', evidence: [] },
    { id: 'sqs:svc-a/fullLoadTriggerSqs', kind: 'queue', store: 'sqs', name: 'fullLoadTriggerSqs', owner: 'svc-a', evidence: [] },
    { id: 'sqs:svc-b/fullLoadTriggerSqs', kind: 'queue', store: 'sqs', name: 'fullLoadTriggerSqs', owner: 'svc-b', evidence: [] },
  ]
  const serverless = new Map([['svc-employees', sls({ streamConsumers: [{ stream: 'skelloapp-bus', kind: 'kinesis', raw: 'x' }] })]])
  const sources = new Map([
    ['skello-app', [
      { file: 'app/services/a.rb', source: 'ActiveRecord::Base.transaction do\n  save!\nend' },
      { file: 'config/locales/fr.yml', source: 'title: "Start a transaction now"' },
      { file: 'app/jobs/send.rb', source: "client.send_message(queue_url: 'svcPos-transaction-production')" },
    ]],
    ['svc-employees', [{ file: 'serverless.ts', source: 'stream: `arn:aws:kinesis:${region}:${account}:stream/skelloapp-bus-${stage}`' }]],
    ['svc-b', [{ file: 'serverless.ts', source: "QueueName: 'fullLoadTriggerSqs'" }]],
  ])
  const rels = messagingRelations(resources, serverless, sources).filter(r => r.relation === 'produces').map(r => `${r.resource} ${r.service} ${r.file}`)

  it('needs the name inside a whitespace-free string literal', () => {
    expect(rels).toEqual(['sqs:transaction skello-app app/jobs/send.rb'])
  })
  it('never credits a consumer or a same-named sibling owner as producer', () => {
    expect(rels.some(r => r.startsWith('kinesis:skelloapp-bus'))).toBe(false)
    expect(rels.some(r => r.startsWith('sqs:svc-a/fullLoadTriggerSqs'))).toBe(false)
  })
})

describe('messagingRelations dead-letter queues', () => {
  it('never credits the owner with consuming a DLQ-named queue, whatever the wiring casing', () => {
    const resources: Resource[] = [
      { id: 'sqs:mergeShopSqs', kind: 'queue', store: 'sqs', name: 'mergeShopSqs', owner: 'svc-shops', evidence: [] },
      { id: 'sqs:mergeShopSqsDlq', kind: 'queue', store: 'sqs', name: 'mergeShopSqsDlq', owner: 'svc-shops', evidence: [] },
      { id: 'sqs:kpisCleanup-dlq', kind: 'queue', store: 'sqs', name: 'kpisCleanup-dlq', owner: 'svc-shops', evidence: [] },
    ]
    const serverless = new Map([['svc-shops', sls({ dlqWirings: [{ queue: 'MergeShopSqs', dlq: 'MergeShopSqsDlq', retry: null, via: 'redrive' }] })]])
    const sources = new Map([['svc-shops', [{ file: 'serverless/functions.ts', source: "events: [{ sqs: { arn: 'x' } }]" }]]])
    expect(messagingRelations(resources, serverless, sources).filter(r => r.relation === 'consumes').map(r => r.resource)).toEqual(['sqs:mergeShopSqs'])
  })
})

describe('atlasRelations', () => {
  it('turns Atlas roles into config-graded writes and reads', () => {
    const db = (name: string): Resource => ({ id: `mongo:${name}`, kind: 'database', store: 'mongodb', name, evidence: [] })
    const facts = { resources: [], dmsTasks: [], dmsEndpoints: [], iamActions: [], mongoRoles: [{ role: 'readWrite', database: 'svc-shops' }, { role: 'read', database: 'svc-search' }] }
    expect(atlasRelations([{ service: 'svc-shops', facts }], [db('svc-shops'), db('svc-search')])).toEqual([
      { resource: 'mongo:svc-shops', relation: 'writes', service: 'svc-shops', grade: 'config' },
      { resource: 'mongo:svc-search', relation: 'reads', service: 'svc-shops', grade: 'config' },
    ])
  })
})

describe('dmsRelations', () => {
  it('credits each stream once whatever the number of tasks feeding it', () => {
    const facts = {
      resources: [{ tfType: 'aws_kinesis_stream', label: 's', name: 'skelloapp-svcsearch-fullload' }],
      dmsTasks: [{ label: 'a', source: 'skelloapp-database', target: 'aws_dms_endpoint.k.endpoint_arn' }, { label: 'b', source: 'skelloapp-database', target: 'aws_dms_endpoint.k.endpoint_arn' }],
      dmsEndpoints: [{ label: 'k', streamLabel: 's' }],
      iamActions: [], mongoRoles: [],
    }
    const stream: Resource = { id: 'kinesis:skelloapp-svcsearch-fullload', kind: 'stream', store: 'kinesis', name: 'skelloapp-svcsearch-fullload', owner: 'svc-search', evidence: [] }
    expect(dmsRelations([{ service: 'svc-search', facts }], [stream])).toHaveLength(1)
  })
  it('credits the DMS source with producing to the target stream', () => {
    const facts = {
      resources: [{ tfType: 'aws_kinesis_stream', label: 'skelloapp_bus', name: 'skelloapp-bus-${local.workspace}' }, { tfType: 'aws_kinesis_stream', label: 'own', name: 'svcRequests-cdc' }],
      dmsTasks: [
        { label: 'bus', source: 'aws_dms_endpoint.skelloapp_aurora.endpoint_arn', target: 'aws_dms_endpoint.bus[0].endpoint_arn' },
        { label: 'own', source: 'aws_dms_endpoint.svc_requests_aurora[0].endpoint_arn', target: 'aws_dms_endpoint.own.endpoint_arn' },
      ],
      dmsEndpoints: [{ label: 'bus', streamLabel: 'skelloapp_bus' }, { label: 'own', streamLabel: 'own' }],
      iamActions: [], mongoRoles: [],
    }
    const stream = (id: string, name: string, owner: string): Resource => ({ id, kind: 'stream', store: 'kinesis', name, owner, evidence: [] })
    expect(dmsRelations([{ service: 'svc-requests', facts }], [stream('kinesis:skelloapp-bus', 'skelloapp-bus', 'svc-requests'), stream('kinesis:cdc', 'cdc', 'svc-requests')])).toEqual([
      { resource: 'kinesis:skelloapp-bus', relation: 'produces', service: 'skello-app', grade: 'config' },
      { resource: 'kinesis:cdc', relation: 'produces', service: 'svc-requests', grade: 'config' },
    ])
  })
})

describe('messagingRelations literal kinds', () => {
  const stream = (name: string, owner: string): Resource => ({ id: `kinesis:${name}`, kind: 'stream', store: 'kinesis', name, owner, evidence: [] })
  const resources = [stream('svcBillingAutomation', 'svc-billing-automation'), stream('eSignature-V2', 'svc-documents-esignature'), stream('documentEvents', 'svc-documents-v2')]
  const sources = new Map([
    ['svc-billing-automation', [{ file: 'src/a.ts', source: '' }]],
    ['skello-app', [{ file: 'app/controllers/x.rb', source: "request.headers['X-Source-Client'] == 'svcBillingAutomation'" }]],
    ['svc-users', [
      { file: 'serverless.ts', source: "value: '/svcBillingAutomation/API_KEY'" },
      { file: 'src/ssm.ts', source: "get('/svcDocuments/documentEvents-stream')" },
    ]],
    ['svc-documents-v2', [{ file: 'serverless.ts', source: 'Resource: `arn:aws:dynamodb:${region}:${account}:table/svcDocuments-eSignature-V2-${stage}`' }]],
    ['svc-hris', [{ file: 'serverless.ts', source: 'Resource: `arn:aws:kinesis:${region}:${account}:stream/svcDocumentsV2-documentEvents-${stage}`' }]],
  ])
  const rels = messagingRelations(resources, new Map(), sources).filter(r => r.relation === 'produces').map(r => `${r.resource} ${r.service}`)

  it('ignores service-stem names, SSM paths and ARNs of another AWS service', () => {
    expect(rels).toEqual(['kinesis:documentEvents svc-hris'])
  })
})

describe('messagingRelations per-queue consumers and owner producers', () => {
  const queue = (name: string, owner: string): Resource => ({ id: `sqs:${name}`, kind: 'queue', store: 'sqs', name, owner, evidence: [] })
  const resources = [queue('createActivityLogJob', 'svc-events'), queue('archiveEventsJob', 'svc-events')]
  const sources = new Map([
    ['svc-events', [
      { file: 'serverless/functions/queues.ts', source: "events: [{ sqs: { arn: 'x' } }] QueueName: 'archiveEventsJob'" },
      { file: 'src/Manager/ArchiveManager.ts', source: "sendMessage({ queue: 'archiveEventsJob' })" },
    ]],
  ])

  it('credits the owner as consumer of the queues its events read, when those are known', () => {
    const serverless = new Map([['svc-events', sls({ sqsConsumers: ['createActivityLogJob'] })]])
    const consumes = messagingRelations(resources, serverless, sources).filter(r => r.relation === 'consumes').map(r => r.resource)
    expect(consumes).toEqual(['sqs:createActivityLogJob'])
  })
  it('credits the owner as producer when its code, not its serverless config, names its queue', () => {
    const produces = messagingRelations(resources, new Map(), sources).filter(r => r.relation === 'produces').map(r => `${r.resource} ${r.service} ${r.file}`)
    expect(produces).toEqual(['sqs:archiveEventsJob svc-events src/Manager/ArchiveManager.ts'])
  })
})

describe('dmsRelations sources', () => {
  it('credits the repo whose database the DMS source endpoint reads', () => {
    const facts = {
      resources: [{ tfType: 'aws_kinesis_stream', label: 's', name: 'svckpis-svckpisv2-user-kpis-settings-cdc' }],
      dmsTasks: [{ label: 't', source: 'svckpis-source-user-kpis-settings', target: 'aws_dms_endpoint.k.endpoint_arn' }],
      dmsEndpoints: [{ label: 'k', streamLabel: 's' }],
      iamActions: [], mongoRoles: [],
    }
    const stream: Resource = { id: 'kinesis:svckpis-svckpisv2-user-kpis-settings-cdc', kind: 'stream', store: 'kinesis', name: 'svckpis-svckpisv2-user-kpis-settings-cdc', owner: 'svc-kpis-v2', evidence: [] }
    const kpis: Resource = { id: 'pg:svc-kpis', kind: 'database', store: 'postgresql', name: 'svc-kpis', owner: 'svc-kpis', evidence: [] }
    expect(dmsRelations([{ service: 'svc-kpis-v2', facts }], [stream, kpis]).map(r => r.service)).toEqual(['svc-kpis'])
  })
  it('reads the production branch of a conditional source endpoint', () => {
    const facts = {
      resources: [{ tfType: 'aws_kinesis_stream', label: 'full', name: 'fullload' }],
      dmsTasks: [{ label: 'f', source: 'local.workspace != "prod" ? aws_dms_endpoint.svc_requests_aurora[0].endpoint_arn : data.aws_dms_endpoint.skelloapp_rds[0].endpoint_arn', target: 'aws_dms_endpoint.k.endpoint_arn' }],
      dmsEndpoints: [{ label: 'k', streamLabel: 'full' }],
      iamActions: [], mongoRoles: [],
    }
    const stream: Resource = { id: 'kinesis:svc-requests/fullload', kind: 'stream', store: 'kinesis', name: 'fullload', owner: 'svc-requests', evidence: [] }
    expect(dmsRelations([{ service: 'svc-requests', facts }], [stream]).map(r => r.service)).toEqual(['skello-app'])
  })
})

describe('dedupeRelations', () => {
  it('keeps one row per resource, relation, service, file and target', () => {
    const row = { resource: 'kinesis:skelloapp-bus', relation: 'consumes' as const, service: 'svc-search', grade: 'config' as const }
    expect(dedupeRelations([row, { ...row }, { ...row, service: 'svc-users' }])).toEqual([row, { ...row, service: 'svc-users' }])
  })
})
