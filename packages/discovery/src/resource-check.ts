import type { Resource } from '@dependency-explorer/schema'
import type { RailsModel } from './extractors/rails-schema'

export interface ResourceFinding { subject: string; kind: 'resource-gone' | 'resource-new' | 'model-without-table'; detail: string }

export function checkResources(committed: Resource[], live: Resource[], models: RailsModel[], tables: string[]) {
  const liveIds = new Set(live.map(x => x.id))
  const committedIds = new Set(committed.map(x => x.id))
  const findings: ResourceFinding[] = [
    ...committed.filter(x => !liveIds.has(x.id)).map(x => ({ subject: x.id, kind: 'resource-gone' as const, detail: `${x.id} has no evidence at the pinned commit — pnpm discover:apply drops it` })),
    ...live.filter(x => !committedIds.has(x.id)).map(x => ({ subject: x.id, kind: 'resource-new' as const, detail: `${x.id} (${x.evidence.join(', ')}) is not in resources.json — pnpm discover:apply adds it` })),
    ...models.filter(m => !tables.includes(m.table)).map(m => ({ subject: m.className, kind: 'model-without-table' as const, detail: `${m.file} maps to "${m.table}", absent from db/schema.rb` })),
  ]
  const mapped = new Set(models.map(m => m.table))
  return {
    findings,
    modelLess: tables.filter(t => !mapped.has(t)),
    datasetOnly: live.filter(x => x.evidence.every(e => e.startsWith('dataset:'))).length,
  }
}
