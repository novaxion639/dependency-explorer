import type { Listener, ListenerSurface, ResourceRelation, WriteSite } from '@dependency-explorer/schema'
import type { ListenerFinding } from './extractors/rails-listeners'

export interface ListenerCheck { findings: ListenerFinding[]; listeners: number; writeSites: number; feeds: number; skipped: boolean }

const siteKey = (s: WriteSite) => `${s.table}|${s.file}|${s.call}`
const cdcKey = (r: ResourceRelation) => `${r.resource}|${r.relation}|${r.service}|${r.target ?? ''}`

export function isCdcRelation(r: ResourceRelation): boolean {
  return r.resource.startsWith('pg:') && r.grade === 'config' && (r.relation === 'feeds' || r.relation === 'consumes')
}

function diff(now: string[], before: string[], what: string): ListenerFinding[] {
  const was = new Set(before)
  const is = new Set(now)
  return [
    ...[...is].filter(k => !was.has(k)).map(k => ({ kind: 'surface-drift' as const, subject: `${what} ${k}`, detail: `${what} at the pinned commit, absent from the committed surface — pnpm discover:apply adds it` })),
    ...[...was].filter(k => !is.has(k)).map(k => ({ kind: 'surface-drift' as const, subject: `${what} ${k}`, detail: `${what} no longer at the pinned commit — pnpm discover:apply drops it` })),
  ]
}

export function surfaceDrift(live: { listeners: Listener[]; writeSites: WriteSite[]; cdc: ResourceRelation[] }, committed: { surface: ListenerSurface | null; relations: ResourceRelation[] }): ListenerFinding[] {
  if (committed.surface === null) {
    return [{ kind: 'surface-drift', subject: 'listeners.json', detail: 'packages/data/src/generated/listeners.json is absent — pnpm discover:apply writes it' }]
  }
  return [
    ...diff(live.listeners.map(l => l.id), committed.surface.listeners.map(l => l.id), 'listener'),
    ...diff(live.writeSites.map(siteKey), committed.surface.writeSites.map(siteKey), 'write site'),
    ...diff(live.cdc.map(cdcKey), committed.relations.filter(isCdcRelation).map(cdcKey), 'CDC relation'),
  ]
}
