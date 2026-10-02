import type { Resource, ResourceRelation } from '@dependency-explorer/schema'
import type { RailsModel } from './extractors/rails-schema'
import { stripComments, type RepoGraph } from './code-grades'
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
      if (!w.has(file) && file !== modelFile) {
        out.push({ resource: r.id, relation: 'reads', service: 'skello-app', file, grade: 'code' })
      }
    }
  }
  return out
}


const MIN_LITERAL = 8
const NON_SENDERS = new Set(['skello-app-front'])
const SQS_EVENT = /\bsqs:\s*(\{|['"`])/

export function messagingRelations(resources: Resource[], serverless: Map<string, ServerlessFacts>, sources: Map<string, Array<{ file: string; source: string }>>): ResourceRelation[] {
  const out: ResourceRelation[] = []
  const byName = new Map(resources.map(r => [`${r.store}:${r.name}`, r]))
  const deadLetterTargets = new Set([...serverless.values()].flatMap(f => f.dlqWirings.flatMap(w => (w.dlq ? [w.dlq] : []))))
  for (const r of resources) {
    if (r.kind === 'queue' && r.owner && !deadLetterTargets.has(r.name) && (sources.get(r.owner) ?? []).some(f => f.file.includes('serverless') && SQS_EVENT.test(f.source))) {
      out.push({ resource: r.id, relation: 'consumes', service: r.owner, grade: 'config' })
    }
    if (['queue', 'topic', 'stream'].includes(r.kind) && r.name.length >= MIN_LITERAL) {
      for (const [repo, files] of sources) {
        if (repo === r.owner || NON_SENDERS.has(repo)) {
          continue
        }
        for (const f of files) {
          if (f.source.includes(r.name)) {
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
