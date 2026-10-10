import type { Listener, ListenerEffect, ListenerSurface, ResourceRelation, WriteSite } from '@dependency-explorer/schema'
import type { ListenerFinding } from './extractors/rails-listeners'

export interface ListenerCheck { findings: ListenerFinding[]; listeners: number; writeSites: number; feeds: number | null; skipped: boolean }

const effectSignature = (e: ListenerEffect) => [e.kind, e.target, e.targetFile ?? '', e.via ?? '', e.mode, e.runs ?? '', (e.events ?? []).join(',')].join('|')
const listenerSignature = (l: Listener) => [l.id, l.events.join(','), l.phase, l.condition ?? '', ...l.effects.map(effectSignature).sort()].join('\n')
const siteSignature = (s: WriteSite) => [s.table, s.file, s.call, s.runs, s.events.join(','), (s.fires ?? []).join(',')].join('|')
const siteSubject = (s: WriteSite) => `write site ${s.table} ${s.file} ${s.call}`
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

function listenerDrift(now: Listener[], before: Listener[]): ListenerFinding[] {
  const was = new Map(before.map(l => [l.id, listenerSignature(l)]))
  const is = new Map(now.map(l => [l.id, listenerSignature(l)]))
  const finding = (id: string, verb: string, fix: string): ListenerFinding => ({ kind: 'surface-drift', subject: `listener ${id}`, detail: `listener ${verb} at the pinned commit — pnpm discover:apply ${fix}` })
  return [
    ...now.filter(l => !was.has(l.id)).map(l => finding(l.id, 'added', 'adds it')),
    ...now.filter(l => was.has(l.id) && was.get(l.id) !== is.get(l.id)).map(l => finding(l.id, 'changed', 'updates it')),
    ...before.filter(l => !is.has(l.id)).map(l => finding(l.id, 'removed', 'drops it')),
  ]
}

function countBy(sites: WriteSite[]): Map<string, { site: WriteSite; count: number }> {
  const counts = new Map<string, { site: WriteSite; count: number }>()
  for (const site of sites) {
    const key = siteSignature(site)
    counts.set(key, { site, count: (counts.get(key)?.count ?? 0) + 1 })
  }
  return counts
}

function siteDrift(now: WriteSite[], before: WriteSite[]): ListenerFinding[] {
  const was = countBy(before)
  const is = countBy(now)
  const detail = (verb: string, site: WriteSite, count: number, fix: string) => `write site ${verb} at the pinned commit (${count}x, runs ${site.runs}, events ${site.events.join(',')}) — pnpm discover:apply ${fix}`
  return [
    ...[...is].flatMap(([key, { site, count }]) => (count > (was.get(key)?.count ?? 0) ? [{ kind: 'surface-drift' as const, subject: siteSubject(site), detail: detail('added', site, count - (was.get(key)?.count ?? 0), 'adds it') }] : [])),
    ...[...was].flatMap(([key, { site, count }]) => (count > (is.get(key)?.count ?? 0) ? [{ kind: 'surface-drift' as const, subject: siteSubject(site), detail: detail('removed', site, count - (is.get(key)?.count ?? 0), 'drops it') }] : [])),
  ]
}

export function surfaceDrift(live: { listeners: Listener[]; writeSites: WriteSite[]; cdc: ResourceRelation[] }, committed: { surface: ListenerSurface | null; relations: ResourceRelation[] }): ListenerFinding[] {
  if (committed.surface === null) {
    return [{ kind: 'surface-drift', subject: 'listeners.json', detail: 'packages/data/src/generated/listeners.json is absent — pnpm discover:apply writes it' }]
  }
  return [
    ...listenerDrift(live.listeners, committed.surface.listeners),
    ...siteDrift(live.writeSites, committed.surface.writeSites),
    ...diff(live.cdc.map(cdcKey), committed.relations.filter(isCdcRelation).map(cdcKey), 'CDC relation'),
  ]
}
