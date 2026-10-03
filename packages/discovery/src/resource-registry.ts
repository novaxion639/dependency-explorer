import type { ConnectivityMap, Resource } from '@dependency-explorer/schema'
import { normalizeResourceName } from '@dependency-explorer/data'
import type { RailsModel } from './extractors/rails-schema'
import type { ServerlessFacts } from './extractors/serverless'
import type { TerraformFacts } from './extractors/terraform'
import { OWNING_ROLES, READING_ROLES } from './resource-relations'

export const STORE_PREFIX: Record<string, string> = {
  postgresql: 'pg', mongodb: 'mongo', dynamodb: 'ddb', s3: 's3', sqs: 'sqs', sns: 'sns', kinesis: 'kinesis', redis: 'redis', elasticsearch: 'es',
}
const MONOLITH_DB = 'skello_production'
const KIND_BY_STORE: Partial<Record<Resource['store'], Resource['kind']>> = { sqs: 'queue', sns: 'topic', kinesis: 'stream', s3: 'bucket', dynamodb: 'table' }
const CF_STORE: Record<string, Resource['store']> = { 'AWS::DynamoDB::Table': 'dynamodb', 'AWS::S3::Bucket': 's3', 'AWS::Kinesis::Stream': 'kinesis', 'AWS::SNS::Topic': 'sns' }
const TF_STORE: Record<string, Resource['store']> = { aws_dynamodb_table: 'dynamodb', aws_s3_bucket: 's3', aws_kinesis_stream: 'kinesis', aws_sqs_queue: 'sqs', aws_sns_topic: 'sns', aws_kinesis_firehose_delivery_stream: 'kinesis', aws_rds_cluster: 'postgresql', aws_db_instance: 'postgresql', aws_elasticache_replication_group: 'redis' }

export interface RegistryInputs {
  monolith: { tables: string[]; models: RailsModel[] } | null
  serverless: Map<string, ServerlessFacts>
  terraform: Array<{ service: string; tfRepo: string; facts: TerraformFacts }>
  services: ConnectivityMap['services']
}

const RESOURCE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const CONSTANT_IDENTIFIER = /^[A-Z0-9_]+$/
const HCL_REFERENCE = /^(local|var|data|module)\./

function isResourceName(name: string): boolean {
  return RESOURCE_NAME.test(name) && !CONSTANT_IDENTIFIER.test(name.split('.').pop() ?? name) && !HCL_REFERENCE.test(name)
}

interface Draft { kind: Resource['kind']; store: Resource['store']; name: string; owners: Set<string>; evidence: Set<string>; ownerEvidence: Map<string, Set<string>>; model?: Resource['model']; related?: string[] }

export function buildRegistry(inputs: RegistryInputs): Resource[] {
  const drafts = new Map<string, Draft>()
  const add = (store: Resource['store'], rawName: string, kind: Resource['kind'], evidence: string, owner?: string) => {
    const { name, ownerHint } = normalizeResourceName(rawName, store)
    if (!isResourceName(name)) {
      return
    }
    const key = `${STORE_PREFIX[store] ?? store}:${name.toLowerCase()}`
    const d = drafts.get(key) ?? { kind, store, name, owners: new Set<string>(), evidence: new Set<string>(), ownerEvidence: new Map<string, Set<string>>() }
    if (/^[a-z]/.test(name) && !/^[a-z]/.test(d.name)) {
      d.name = name
    }
    const who = owner && (!ownerHint || owner.startsWith(ownerHint)) ? owner : ownerHint
    if (who) {
      d.owners.add(who)
      d.ownerEvidence.set(who, (d.ownerEvidence.get(who) ?? new Set<string>()).add(evidence))
    } else {
      d.evidence.add(evidence)
    }
    drafts.set(key, d)
  }

  if (inputs.monolith) {
    const tables = new Set(inputs.monolith.tables)
    const modelByTable = new Map(inputs.monolith.models.map(m => [m.table, m]))
    drafts.set(`pg:${MONOLITH_DB}`, { kind: 'database', store: 'postgresql', name: MONOLITH_DB, owners: new Set(['skello-app']), evidence: new Set(['skello-app:db/schema.rb']), ownerEvidence: new Map() })
    for (const table of inputs.monolith.tables) {
      const model = modelByTable.get(table)
      drafts.set(`pg:${MONOLITH_DB}.${table}`, {
        kind: 'table', store: 'postgresql', name: table, owners: new Set(['skello-app']), evidence: new Set(['skello-app:db/schema.rb']), ownerEvidence: new Map(),
        ...(model ? { model: { file: model.file, className: model.className }, related: model.associations.filter(t => tables.has(t) && t !== table).map(t => `pg:${MONOLITH_DB}.${t}`) } : {}),
      })
    }
  }
  for (const [repo, facts] of inputs.serverless) {
    for (const q of facts.queueNames) {
      add('sqs', q, 'queue', `${repo}:serverless`, repo)
    }
    for (const s of facts.streamConsumers) {
      if (s.kind === 'kinesis') {
        add('kinesis', s.stream, 'stream', `${repo}:serverless`)
      }
    }
    for (const t of facts.s3Triggers) {
      add('s3', t.bucket, 'bucket', `${repo}:serverless`)
    }
    for (const o of facts.ownedResources) {
      const store = CF_STORE[o.cfType]
      if (store) {
        add(store, o.name, KIND_BY_STORE[store] ?? 'database', `${repo}:serverless`, repo)
      }
    }
  }
  for (const t of inputs.terraform) {
    for (const r of t.facts.resources) {
      const store = TF_STORE[r.tfType]
      if (store === 'postgresql' && !/postgres/.test(r.engine ?? '')) {
        continue
      }
      if (store === 'postgresql' && t.service === 'skello-app') {
        drafts.get(`pg:${MONOLITH_DB}`)?.evidence.add(`${t.tfRepo}:terraform`)
        continue
      }
      if (store && r.name) {
        add(store, r.name, KIND_BY_STORE[store] ?? 'database', `${t.tfRepo}:terraform`, t.service)
      }
    }
  }
  for (const t of inputs.terraform) {
    for (const role of t.facts.mongoRoles.filter(r => OWNING_ROLES.has(r.role) || READING_ROLES.has(r.role))) {
      add('mongodb', role.database, 'database', `${t.tfRepo}:terraform`, OWNING_ROLES.has(role.role) ? t.service : undefined)
    }
  }
  for (const svc of inputs.services) {
    for (const db of svc.databases ?? []) {
      if (db.type === 'postgresql' && normalizeResourceName(db.name, db.type).name === MONOLITH_DB) {
        drafts.get(`pg:${MONOLITH_DB}`)?.evidence.add(`dataset:${svc.name}`)
        continue
      }
      if (db.type in STORE_PREFIX) {
        add(db.type, db.name, KIND_BY_STORE[db.type] ?? 'database', `dataset:${svc.name}`)
      }
    }
  }

  const out: Resource[] = []
  for (const [key, d] of drafts) {
    const owners = [...d.owners].sort()
    const split = d.kind !== 'table' && d.kind !== 'database' && owners.length > 1
    const prefix = key.split(':')[0]
    const base = key.startsWith(`pg:${MONOLITH_DB}`) ? key : `${prefix}:${d.name}`
    for (const owner of split ? owners : [owners[0]]) {
      const ownersShown = split && owner ? [owner] : owners
      const evidence = new Set([...d.evidence, ...ownersShown.flatMap(o => [...(d.ownerEvidence.get(o) ?? [])])])
      out.push({
        id: split ? `${prefix}:${owner}/${d.name}` : base,
        kind: d.kind,
        store: d.store,
        name: d.name,
        ...(owner ? { owner } : {}),
        evidence: [...evidence].sort(),
        ...(d.model ? { model: d.model } : {}),
        ...(d.related ? { related: d.related } : {}),
      })
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id))
}
