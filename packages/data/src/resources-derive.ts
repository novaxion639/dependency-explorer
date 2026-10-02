import type { ConnectivityMap, Resource, ResourceRelation } from '@dependency-explorer/schema'
import { normalizeResourceName } from './resource-names'

const MESSAGING = new Set(['sqs', 'sns', 'kinesis'])
const WRITES = new Set(['create', 'update', 'delete'])

export function flowRelations(map: ConnectivityMap): ResourceRelation[] {
  const out: ResourceRelation[] = []
  const services = new Set(map.services.map(s => s.name))
  for (const flow of map.flows) {
    const nodes = new Map((flow.infraNodes ?? []).map(n => [n.id, n]))
    const units = new Map((flow.codeUnits ?? []).map(u => [u.id, u]))
    const actor = (id: string): { service: string; file?: string } | null => {
      const u = units.get(id)
      if (u) {
        return { service: u.service, ...(u.path ? { file: u.path } : {}) }
      }
      return services.has(id) ? { service: id } : null
    }
    for (const e of flow.codeEdges ?? []) {
      const into = nodes.get(e.to)
      const outOf = nodes.get(e.from)
      const from = actor(e.from)
      const to = actor(e.to)
      if (into?.resources && from) {
        const messaging = MESSAGING.has(into.type)
        const writes = !e.crud?.length || e.crud.some(c => WRITES.has(c))
        const relation = messaging ? 'produces' : writes ? 'writes' : 'reads'
        for (const resource of into.resources) {
          out.push({ resource, relation, ...from, grade: 'flow' })
        }
      }
      if (outOf?.resources && to) {
        const relation = MESSAGING.has(outOf.type) ? 'consumes' : 'reads'
        for (const resource of outOf.resources) {
          out.push({ resource, relation, ...to, grade: 'flow' })
        }
      }
    }
  }
  return out
}

export interface ResourceImpact {
  resource: Resource
  byService: Array<{ service: string; relations: ResourceRelation[] }>
  flows: Array<{ flowId: string; name: string; crud: string[] }>
  dlq?: string
  counts: { services: number; files: number; flows: number }
}

export function resourceImpact(id: string, map: ConnectivityMap, resources: Resource[], relations: ResourceRelation[]): ResourceImpact | null {
  const resource = resources.find(r => r.id === id)
  if (!resource) {
    return null
  }
  const seen = new Set<string>()
  const mine = relations.filter(r => {
    const key = `${r.relation}|${r.service}|${r.file ?? ''}|${r.grade}`
    if (r.resource !== id || r.relation === 'dead-letters-to' || seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
  const services = [...new Set(mine.map(r => r.service))].sort()
  const flows = map.flows.flatMap(f => {
    const nodeIds = new Set((f.infraNodes ?? []).filter(n => n.resources?.includes(id)).map(n => n.id))
    if (!nodeIds.size) {
      return []
    }
    const crud = [...new Set((f.codeEdges ?? []).filter(e => nodeIds.has(e.to) || nodeIds.has(e.from)).flatMap(e => e.crud ?? []))].sort()
    return [{ flowId: f.id, name: f.name, crud }]
  })
  const dlq = relations.find(r => r.resource === id && r.relation === 'dead-letters-to')?.target
  const files = new Set(mine.flatMap(r => (r.file ? [`${r.service}/${r.file}`] : [])))
  return {
    resource,
    byService: services.map(service => ({ service, relations: mine.filter(r => r.service === service) })),
    flows,
    ...(dlq ? { dlq } : {}),
    counts: { services: services.length, files: files.size, flows: flows.length },
  }
}

export function resourceIdForDatabase(serviceName: string, db: { type: string; name: string }, resources: Resource[]): string | undefined {
  const name = normalizeResourceName(db.name).name
  return resources.find(r => r.store === db.type && r.name === name && r.evidence.includes(`dataset:${serviceName}`))?.id
}
