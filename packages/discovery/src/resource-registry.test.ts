import { describe, it, expect } from 'vitest'
import { normalizeResourceName } from '@dependency-explorer/data'
import { buildRegistry, type RegistryInputs } from './resource-registry'
import type { ServerlessFacts } from './extractors/serverless'

const sls = (over: Partial<ServerlessFacts>): ServerlessFacts => ({
  source: 'static-scan', endpoints: [], queueNames: [], streamConsumers: [], s3Triggers: [], schedules: [],
  ownedResources: [], dlqWirings: [], authorizerNames: [], ...over,
})

describe('normalizeResourceName', () => {
  it('strips env templates, prefixes and decorations', () => {
    expect(normalizeResourceName('svcEvents-createActivityLogJob-{env}', 'sqs')).toEqual({ name: 'createActivityLogJob', ownerHint: 'svc-events' })
    expect(normalizeResourceName('${prefix}-createActivityLogJob-${stage}', 'sqs')).toEqual({ name: 'createActivityLogJob' })
    expect(normalizeResourceName('svcRequests-{env}', 'sqs')).toEqual({ name: 'svcRequests' })
    expect(normalizeResourceName('svc-documents-v2.{env}', 'sqs')).toEqual({ name: 'svc-documents-v2' })
    expect(normalizeResourceName('svc-search DB (direct read)', 'sqs')).toEqual({ name: 'svc-search' })
  })
  it('keeps the prefix of non-messaging names', () => {
    expect(normalizeResourceName('svcDocuments-eSignature-V2-{env}', 'dynamodb')).toEqual({ name: 'svcDocuments-eSignature-V2' })
    expect(normalizeResourceName('svcEmployees-restaure-${local.workspace}', 'dynamodb')).toEqual({ name: 'svcEmployees-restaure' })
    expect(normalizeResourceName('svcPos-dataLake-{env}', 'kinesis')).toEqual({ name: 'dataLake', ownerHint: 'svc-pos' })
  })
})

describe('buildRegistry', () => {
  const inputs: RegistryInputs = {
    monolith: { tables: ['postes_weekly_options', 'shifts'], models: [{ className: 'Shift', file: 'app/models/shift.rb', table: 'shifts', associations: ['postes', 'tasks'] }] },
    serverless: new Map([
      ['svc-events', sls({ queueNames: ['createActivityLogJob', 'createActivityLogJobDlq'], dlqWirings: [{ queue: 'createActivityLogJob', dlq: 'createActivityLogJobDlq', retry: 'maxReceiveCount 3', via: 'redrive' }] })],
      ['svc-shops', sls({ queueNames: ['mergeShopSqs'] })],
      ['svc-users', sls({ queueNames: ['mergeShopSqs'], ownedResources: [{ cfType: 'AWS::DynamoDB::Table', name: 'svcUsers' }] })],
      ['svc-employees', sls({ streamConsumers: [{ stream: 'skelloapp-bus', kind: 'kinesis', raw: 'arn:…' }] })],
    ]),
    terraform: [],
    services: [
      { name: 'svc-requests', type: 'typescript-microservice', description: 'd', endpoints: [], databases: [{ type: 'sqs', name: 'svcEvents-createActivityLogJob-{env}', description: 'd' }, { type: 'mongodb', name: 'svc-search DB (direct read)', description: 'd' }] },
    ],
  }
  const reg = buildRegistry(inputs)
  const byId = new Map(reg.map(r => [r.id, r]))

  it('creates monolith tables with their model and keeps model-less tables', () => {
    expect(byId.get('pg:skello_production.shifts')?.model).toEqual({ file: 'app/models/shift.rb', className: 'Shift' })
    expect(byId.get('pg:skello_production.shifts')?.related).toEqual([])
    expect(byId.get('pg:skello_production.postes_weekly_options')?.model).toBeUndefined()
    expect(byId.get('pg:skello_production')?.kind).toBe('database')
  })
  it('merges a prefixed dataset name into the owner declaration', () => {
    const q = byId.get('sqs:createActivityLogJob')
    expect(q?.owner).toBe('svc-events')
    expect(q?.evidence).toEqual(['dataset:svc-requests', 'svc-events:serverless'])
  })
  it('keeps same-named queues of different owners apart', () => {
    expect(byId.has('sqs:svc-shops/mergeShopSqs')).toBe(true)
    expect(byId.has('sqs:svc-users/mergeShopSqs')).toBe(true)
    expect(byId.has('sqs:mergeShopSqs')).toBe(false)
  })
  it('covers streams, owned tables and dataset stores', () => {
    expect(byId.get('kinesis:skelloapp-bus')?.kind).toBe('stream')
    expect(byId.get('ddb:svcUsers')?.owner).toBe('svc-users')
    expect(byId.get('mongo:svc-search')?.kind).toBe('database')
  })
})

describe('buildRegistry noise rules', () => {
  const reg = buildRegistry({
    monolith: null,
    serverless: new Map([
      ['svc-users', sls({
        queueNames: ['addEmailToComputeUserCredentialsDlq', 'aggregationEvent-\\.fifo', 'SendDataToFirehose.QUEUE_NAME', 'integrationJob-\\'],
        dlqWirings: [
          { queue: 'addEmailToComputeUserCredentials', dlq: 'AddEmailToComputeUserCredentialsDlq', retry: null, via: 'redrive' },
          { queue: null, dlq: 'AGGREGATE_PLANNED_POSITION_JOB_DLQ_QUEUE_NAME', retry: null, via: 'helper' },
          { queue: 'kpisCleanup', dlq: 'dlqToAppend', retry: null, via: 'helper' },
        ],
      })],
    ]),
    terraform: [{ service: 'svc-employees', tfRepo: 'svc-employees-tf', facts: { resources: [{ tfType: 'aws_dynamodb_table', label: 'restore', name: 'local.dynamodb_table_name_restore' }, { tfType: 'aws_sqs_queue', label: 'q', name: 'data.aws_sqs_queue.generic_message.name' }], dmsTasks: [], dmsEndpoints: [], iamActions: [], mongoRoles: [] } }],
    services: [{ name: 'svc-billing-automation', type: 'typescript-microservice', description: 'd', endpoints: [], databases: [{ type: 'sqs', name: 'billing job queues ×6 (+DLQs)', description: 'd' }] }],
  })
  const ids = reg.map(r => r.id)

  it('merges logical-id casing into one queue named as declared', () => {
    expect(ids.filter(id => id.toLowerCase() === 'sqs:addemailtocomputeusercredentialsdlq')).toEqual(['sqs:addEmailToComputeUserCredentialsDlq'])
  })
  it('drops expressions, constant identifiers and prose, and cleans escaped suffixes', () => {
    expect(ids).toEqual(['sqs:addEmailToComputeUserCredentialsDlq', 'sqs:aggregationEvent.fifo', 'sqs:integrationJob'])
  })
})

describe('buildRegistry Terraform streams', () => {
  it('registers Firehose delivery streams as kinesis streams', () => {
    const reg = buildRegistry({ monolith: null, serverless: new Map(), services: [], terraform: [{ service: 'svc-pos', tfRepo: 'svc-pos-tf', facts: { resources: [{ tfType: 'aws_kinesis_firehose_delivery_stream', label: 'd', name: 'svcPos-dataLake-${local.workspace}' }], dmsTasks: [], dmsEndpoints: [], iamActions: [], mongoRoles: [] } }] })
    expect(reg.map(r => `${r.id}:${r.kind}:${r.owner}`)).toEqual(['kinesis:dataLake:stream:svc-pos'])
  })
})

describe('buildRegistry owners', () => {
  const tf = (service: string, name: string) => ({ service, tfRepo: `${service}-tf`, facts: { resources: [{ tfType: 'aws_kinesis_stream', label: 's', name }], dmsTasks: [], dmsEndpoints: [], iamActions: [], mongoRoles: [] } })
  it('gives each split resource only its own owner evidence plus unattributed evidence', () => {
    const reg = buildRegistry({
      monolith: null,
      serverless: new Map([['svc-hris', sls({ streamConsumers: [{ stream: 'full-load', kind: 'kinesis', raw: 'arn:…' }] })]]),
      terraform: [tf('svc-punch', 'full-load'), tf('svc-shops', 'full-load')],
      services: [],
    })
    expect(reg.map(r => [r.id, r.evidence])).toEqual([
      ['kinesis:svc-punch/full-load', ['svc-hris:serverless', 'svc-punch-tf:terraform']],
      ['kinesis:svc-shops/full-load', ['svc-hris:serverless', 'svc-shops-tf:terraform']],
    ])
  })
  it('credits a prefixed name to the service it names, not the repo declaring it', () => {
    const reg = buildRegistry({
      monolith: null,
      serverless: new Map([
        ['svc-events', sls({ queueNames: ['createActivityLogJob'] })],
        ['svc-requests', sls({ queueNames: ['svcEvents-createActivityLogJob-${sls:stage}'] })],
      ]),
      terraform: [],
      services: [],
    })
    expect(reg.map(r => `${r.id}:${r.owner}`)).toEqual(['sqs:createActivityLogJob:svc-events'])
  })
  it('keeps the declaring repo when the prefix is its project stem', () => {
    const reg = buildRegistry({ monolith: null, serverless: new Map(), services: [], terraform: [tf('svc-documents-esignature', 'svcDocuments-full-load')] })
    expect(reg.map(r => `${r.id}:${r.owner}`)).toEqual(['kinesis:full-load:svc-documents-esignature'])
  })
})

describe('buildRegistry Terraform databases', () => {
  const tfFacts = (resources: Array<{ tfType: string; label: string; name: string; engine?: string }>) => ({ resources, dmsTasks: [], dmsEndpoints: [], iamActions: [], mongoRoles: [] })
  it('registers Aurora PostgreSQL clusters and Valkey groups as databases, and folds the monolith cluster into skello_production', () => {
    const reg = buildRegistry({
      monolith: { tables: [], models: [] },
      serverless: new Map(),
      services: [],
      terraform: [
        { service: 'svc-requests', tfRepo: 'svc-requests-tf', facts: tfFacts([{ tfType: 'aws_rds_cluster', label: 'db', name: 'svcrequests-${local.workspace}', engine: 'aurora-postgresql' }]) },
        { service: 'svc-x', tfRepo: 'svc-x-tf', facts: tfFacts([{ tfType: 'aws_rds_cluster', label: 'db', name: 'svcx-mysql', engine: 'aurora-mysql' }]) },
        { service: 'skello-app', tfRepo: 'skello-app-tf', facts: tfFacts([{ tfType: 'aws_rds_cluster', label: 'db', name: 'skelloapp-${local.workspace}', engine: 'aurora-postgresql' }, { tfType: 'aws_elasticache_replication_group', label: 'cache', name: 'skelloApp-valkey-${local.workspace}' }]) },
      ],
    })
    expect(reg.map(r => `${r.id}:${r.kind}:${r.owner}`)).toEqual(['pg:skello_production:database:skello-app', 'pg:svcrequests:database:svc-requests', 'redis:skelloApp-valkey:database:skello-app'])
    expect(reg.find(r => r.id === 'pg:skello_production')?.evidence).toContain('skello-app-tf:terraform')
  })
})

describe('buildRegistry Atlas databases', () => {
  it('ignores Atlas roles that grant no data access, such as atlasAdmin on admin', () => {
    const facts = { resources: [], dmsTasks: [], dmsEndpoints: [], iamActions: [], mongoRoles: [{ role: 'atlasAdmin', database: 'admin' }] }
    expect(buildRegistry({ monolith: null, serverless: new Map(), services: [], terraform: [{ service: 'svc-intelligence', tfRepo: 'svc-intelligence-tf', facts }] })).toEqual([])
  })
  it('owns a readWrite database and records read access as unattributed evidence', () => {
    const facts = { resources: [], dmsTasks: [], dmsEndpoints: [], iamActions: [], mongoRoles: [{ role: 'readWrite', database: 'svc-shops' }, { role: 'read', database: 'svc-search' }] }
    const reg = buildRegistry({ monolith: null, serverless: new Map(), services: [], terraform: [{ service: 'svc-shops', tfRepo: 'svc-shops-tf', facts }] })
    expect(reg.map(r => `${r.id}:${r.owner ?? '-'}:${r.evidence.join(',')}`)).toEqual(['mongo:svc-search:-:svc-shops-tf:terraform', 'mongo:svc-shops:svc-shops:svc-shops-tf:terraform'])
  })
})
