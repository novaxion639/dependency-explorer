import type { Resource, ResourceRelation } from '@dependency-explorer/schema'
import type { RailsModel } from './extractors/rails-schema'
import { stripComments, type RepoGraph } from './code-grades'
import { OWNING_ROLES, READING_ROLES, type TerraformFacts } from './extractors/terraform'
import { normalizeResourceName } from '@dependency-explorer/data'
import type { ServerlessFacts } from './extractors/serverless'

export const WRITE_CALL = /\.(create!?|create_or_find_by!?|find_or_create_by!?|insert!?|insert_all!?|upsert|upsert_all|update_all|delete_all|destroy_all|delete_by|destroy_by)\b/

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function tableWriters(files: Array<{ file: string; source: string }>, models: RailsModel[]): Map<string, Set<string>> {
  const writers = new Map<string, Set<string>>()
  const patterns = models.map(m => ({ table: m.table, re: new RegExp(`\\b${escape(m.className)}\\.`, 'g') }))
  for (const { file, source } of files) {
    for (const line of stripComments(source).split('\n')) {
      for (const { table, re } of patterns) {
        re.lastIndex = 0
        const hit = re.exec(line)
        if (hit && WRITE_CALL.test(line.slice(hit.index + hit[0].length - 1))) {
          writers.set(table, new Set([...(writers.get(table) ?? []), file]))
        }
      }
    }
  }
  return writers
}

export function tableRelations(resources: Resource[], models: RailsModel[], files: Array<{ file: string; source: string }>, graph: RepoGraph | null): ResourceRelation[] {
  const writers = tableWriters(files, models)
  const scanned = new Set(files.map(f => f.file))
  const inbound = new Map<string, Set<string>>()
  for (const [from, tos] of graph?.fileEdges ?? new Map<string, Set<string>>()) {
    for (const to of tos) {
      inbound.set(to, new Set([...(inbound.get(to) ?? []), from]))
    }
  }
  const out: ResourceRelation[] = []
  for (const r of resources) {
    if (r.kind !== 'table' || r.store !== 'postgresql' || !r.model) {
      continue
    }
    const modelFile = r.model.file
    const w = writers.get(r.name) ?? new Set<string>()
    for (const file of [...w].sort()) {
      out.push({ resource: r.id, relation: 'writes', service: 'skello-app', file, grade: 'code' })
    }
    for (const file of [...(inbound.get(modelFile) ?? [])].sort()) {
      if (scanned.has(file) && !w.has(file) && file !== modelFile) {
        out.push({ resource: r.id, relation: 'reads', service: 'skello-app', file, grade: 'code' })
      }
    }
  }
  return out
}


const MIN_LITERAL = 10
const NON_SENDERS = new Set(['skello-app-front'])
const SQS_EVENT = /\bsqs:\s*(\{|['"`])/
const DLQ_NAME = /dlq/i
const IDENTIFIER_LITERAL = /(['"`])([^'"`\s]+)\1/g
const SSM_PATH = /^\//
const ARN_SERVICE = /^arn:aws:([a-z0-9-]+):/
const ARN_SERVICES_BY_STORE: Record<string, string[]> = { sqs: ['sqs'], sns: ['sns'], kinesis: ['kinesis', 'firehose'] }

function camelStem(repo: string): string {
  return repo.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
}

function namesResource(literal: string, store: string): boolean {
  const arnService = literal.match(ARN_SERVICE)?.[1]
  return !SSM_PATH.test(literal) && (!arnService || (ARN_SERVICES_BY_STORE[store] ?? []).includes(arnService))
}

export function messagingRelations(resources: Resource[], serverless: Map<string, ServerlessFacts>, sources: Map<string, Array<{ file: string; source: string }>>): ResourceRelation[] {
  const out: ResourceRelation[] = []
  const byName = new Map(resources.map(r => [`${r.store}:${r.name}`, r]))
  const deadLetterTargets = new Set([...serverless.values()].flatMap(f => f.dlqWirings.flatMap(w => (w.dlq ? [w.dlq.toLowerCase()] : []))))
  const isDeadLetter = (name: string) => DLQ_NAME.test(name) || deadLetterTargets.has(name.toLowerCase())
  const consumersOf = new Map<string, Set<string>>()
  for (const [repo, facts] of serverless) {
    const consumed = [...facts.streamConsumers.map(c => `kinesis:${c.stream}`), ...facts.s3Triggers.map(t => `s3:${t.bucket}`)]
    for (const key of consumed) {
      const id = byName.get(key)?.id
      if (id) {
        consumersOf.set(id, new Set([...(consumersOf.get(id) ?? []), repo]))
      }
    }
  }
  const ownersOfName = new Map<string, Set<string>>()
  for (const r of resources) {
    if (r.owner) {
      ownersOfName.set(`${r.store}:${r.name}`, new Set([...(ownersOfName.get(`${r.store}:${r.name}`) ?? []), r.owner]))
    }
  }
  const serviceStems = new Set([...sources.keys(), ...serverless.keys()].map(camelStem))
  const literalCache = new Map<string, string[]>()
  const literalsOf = (repo: string, f: { file: string; source: string }) => {
    const key = `${repo}/${f.file}`
    const cached = literalCache.get(key)
    if (cached) {
      return cached
    }
    const found = [...f.source.matchAll(IDENTIFIER_LITERAL)].map(m => m[2] ?? '')
    literalCache.set(key, found)
    return found
  }
  for (const r of resources) {
    const ownerFacts = r.owner ? serverless.get(r.owner) : undefined
    const knownConsumers = ownerFacts?.sqsConsumers
    const readsByEvent = knownConsumers
      ? knownConsumers.includes(r.name)
      : (sources.get(r.owner ?? '') ?? []).some(f => f.file.includes('serverless') && SQS_EVENT.test(f.source))
    if (r.kind === 'queue' && r.owner && !isDeadLetter(r.name) && readsByEvent) {
      out.push({ resource: r.id, relation: 'consumes', service: r.owner, grade: 'config' })
    }
    if (['queue', 'topic', 'stream'].includes(r.kind) && r.name.length >= MIN_LITERAL && !serviceStems.has(r.name)) {
      for (const [repo, files] of sources) {
        const siblingOwner = repo !== r.owner && (ownersOfName.get(`${r.store}:${r.name}`)?.has(repo) ?? false)
        if (NON_SENDERS.has(repo) || consumersOf.get(r.id)?.has(repo) || siblingOwner) {
          continue
        }
        const token = new RegExp(`(?<![A-Za-z0-9_])${escape(r.name)}(?![A-Za-z0-9_])`)
        for (const f of files) {
          if (repo === r.owner && f.file.includes('serverless')) {
            continue
          }
          if (literalsOf(repo, f).some(l => namesResource(l, r.store) && token.test(l))) {
            out.push({ resource: r.id, relation: 'produces', service: repo, file: f.file, grade: f.file.includes('serverless') ? 'config' : 'code' })
          }
        }
      }
    }
  }
  for (const [repo, facts] of serverless) {
    for (const s of facts.streamConsumers) {
      const r = byName.get(`kinesis:${s.stream}`)
      if (r) {
        out.push({ resource: r.id, relation: 'consumes', service: repo, grade: 'config' })
      }
    }
    for (const t of facts.s3Triggers) {
      const r = byName.get(`s3:${t.bucket}`)
      if (r) {
        out.push({ resource: r.id, relation: 'consumes', service: repo, grade: 'config' })
      }
    }
    const pick = (name: string | null) => (name ? resources.find(x => x.store === 'sqs' && x.name === name && (x.owner === repo || !x.owner)) : undefined)
    for (const w of facts.dlqWirings) {
      const q = pick(w.queue)
      const dlq = pick(w.dlq)
      if (q && dlq) {
        out.push({ resource: q.id, relation: 'dead-letters-to', service: repo, target: dlq.id, grade: 'config' })
      }
    }
  }
  return out
}


export function atlasRelations(terraform: Array<{ service: string; facts: TerraformFacts }>, resources: Resource[]): ResourceRelation[] {
  const out: ResourceRelation[] = []
  for (const t of terraform) {
    for (const role of t.facts.mongoRoles) {
      const name = normalizeResourceName(role.database, 'mongodb').name
      const r = resources.find(x => x.store === 'mongodb' && x.name === name)
      if (r && (OWNING_ROLES.has(role.role) || READING_ROLES.has(role.role))) {
        out.push({ resource: r.id, relation: OWNING_ROLES.has(role.role) ? 'writes' : 'reads', service: t.service, grade: 'config' })
      }
    }
  }
  return out
}

const MONOLITH = 'skello-app'

function compactName(repo: string): string {
  return repo.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function productionBranch(source: string): string {
  const m = source.match(/([!=]=)\s*"prod"\s*\?\s*(.+?)\s*:\s*(.+)$/)
  if (!m) {
    return source
  }
  return (m[1] === '!=' ? m[3] : m[2]) ?? source
}

function dmsSourceRepo(source: string | undefined, repos: string[], fallback: string): string {
  const compact = compactName(productionBranch(source ?? ''))
  const matches = repos.filter(repo => compact.includes(compactName(repo)))
  return matches.sort((a, b) => compactName(b).length - compactName(a).length)[0] ?? fallback
}

export function dedupeRelations(rels: ResourceRelation[]): ResourceRelation[] {
  const seen = new Set<string>()
  return rels.filter(r => {
    const key = [r.resource, r.relation, r.service, r.file ?? '', r.target ?? ''].join('|')
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

export function dmsRelations(terraform: Array<{ service: string; facts: TerraformFacts }>, resources: Resource[]): ResourceRelation[] {
  const out: ResourceRelation[] = []
  const repos = [...new Set([MONOLITH, ...resources.flatMap(r => (r.owner ? [r.owner] : [])), ...terraform.map(t => t.service)])]
  for (const t of terraform) {
    const streamByEndpoint = new Map(t.facts.dmsEndpoints.flatMap(e => (e.streamLabel ? [[e.label, e.streamLabel] as const] : [])))
    const nameByLabel = new Map(t.facts.resources.filter(r => r.tfType === 'aws_kinesis_stream' && r.name).map(r => [r.label, normalizeResourceName(r.name ?? '', 'kinesis').name]))
    for (const task of t.facts.dmsTasks) {
      const endpoint = task.target?.match(/aws_dms_endpoint\.([\w-]+)/)?.[1]
      const name = nameByLabel.get(streamByEndpoint.get(endpoint ?? '') ?? '')
      const stream = resources.find(r => r.store === 'kinesis' && r.name === name && (!r.owner || r.owner === t.service))
      const service = dmsSourceRepo(task.source, repos, t.service)
      if (stream && !out.some(r => r.resource === stream.id && r.service === service)) {
        out.push({ resource: stream.id, relation: 'produces', service, grade: 'config' })
      }
    }
  }
  return out
}
