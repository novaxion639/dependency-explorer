import type { Resource, ResourceRelation } from '@dependency-explorer/schema'
import type { RailsModel } from './extractors/rails-schema'
import { stripComments, type RepoGraph } from './code-grades'

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
