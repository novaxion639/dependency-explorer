import { tableName, type ConnectivityMap, type Listener, type Resource } from '@dependency-explorer/data'
import type { UrlState } from '../hooks/useUrlState'
import { edgeKey, pagePatch, selectServicePatch } from '../hooks/useUrlState'
import type { FlagRegistryEntry } from './flagRegistry'
import type { FileIndexEntry } from './fileIndex'
import { plural } from './plural'

type SearchResultType = 'service' | 'endpoint' | 'connection' | 'flow' | 'area' | 'term' | 'external' | 'team' | 'resource' | 'listener' | 'flag' | 'file'

export interface SearchEntry {
  type: SearchResultType
  /** Primary display text — matched with the highest weight */
  label: string
  /** Secondary display line */
  sublabel: string
  /** Extra matchable text (descriptions, SDK packages, queue names) — never displayed */
  haystack: string
  /** URL-state patch applied when the entry is chosen — results ARE permalinks */
  patch: Partial<UrlState>
}

const TYPE_ORDER: Record<SearchResultType, number> = {
  service: 0, endpoint: 1, connection: 2, flow: 3, area: 4, term: 5, external: 6, team: 7, resource: 8, listener: 9, flag: 10, file: 11,
}

// Choosing a result fully describes the target view: modal/popup params are
// reset explicitly so the landing state never mixes with whatever was open.
export function buildSearchIndex(map: ConnectivityMap, files: Map<string, FileIndexEntry>, flags: Map<string, FlagRegistryEntry>, resources: Resource[], listeners: Listener[]): SearchEntry[] {
  const entries: SearchEntry[] = []

  for (const svc of map.services) {
    entries.push({
      type: 'service',
      label: svc.name,
      sublabel: svc.description,
      haystack: `${svc.type} ${(svc.tags ?? []).join(' ')}`,
      patch: selectServicePatch(svc.name),
    })
    for (const ep of svc.endpoints) {
      entries.push({
        type: 'endpoint',
        label: `${ep.method} ${ep.path}`,
        sublabel: `${svc.name} · ${ep.description}`,
        haystack: `${ep.id} ${ep.useCase}`,
        patch: { ...selectServicePatch(svc.name), drawer: svc.name, ep: ep.id },
      })
    }
  }

  for (const r of resources) {
    entries.push({
      type: 'resource',
      label: r.name,
      sublabel: `${r.kind} · ${r.store}${r.owner ? ` · ${r.owner}` : ''}`,
      haystack: r.id,
      patch: { ...pagePatch('resources'), resource: r.id },
    })
  }

  for (const l of listeners) {
    const table = tableName(l.table)
    if (l.method) {
      entries.push({ type: 'listener', label: l.method, sublabel: `${table} · ${l.hook}`, haystack: l.id, patch: { ...pagePatch('resources'), resource: l.table, listener: l.id } })
    }
    for (const job of new Set(l.effects.filter(e => e.kind === 'enqueues').map(e => e.target))) {
      entries.push({ type: 'listener', label: job, sublabel: `job · enqueued by ${l.id}`, haystack: `${job} ${l.id}`, patch: { ...pagePatch('resources'), resource: l.table, listener: l.id } })
    }
  }

  for (const conn of map.connections) {
    entries.push({
      type: 'connection',
      label: `${conn.from} → ${conn.to}`,
      sublabel: `${conn.communicationType}/${conn.protocol} · ${conn.description}`,
      haystack: `${conn.sdkPackage} ${(conn.usedEndpoints ?? []).join(' ')}`,
      patch: { ...selectServicePatch(conn.from), edge: edgeKey(conn.from, conn.to, conn.protocol) },
    })
  }

  for (const flow of map.flows ?? []) {
    entries.push({
      type: 'flow',
      label: flow.name,
      sublabel: flow.description,
      // unit paths/labels in the haystack: typing a file name surfaces the flows crossing it
      haystack: [
        ...flow.steps.map(s => `${s.from} ${s.to} ${s.action}`),
        ...(flow.codeUnits ?? []).map(u => `${u.path ?? ''} ${u.label}`),
      ].join(' '),
      patch: { ...pagePatch('flows'), flow: flow.id },
    })
  }

  // Reverse code→flows index — derived from codeUnits[].path, zero authored data
  for (const entry of [...files.values()].filter(f => f.flows.length > 0 || f.routes.length > 0)) {
    entries.push({
      type: 'file',
      label: entry.path,
      sublabel: `${entry.service} · touched by ${plural(entry.flows.length, 'flow')}${entry.routes.length ? ` · serves ${plural(entry.routes.length, 'route')}` : ''}`,
      haystack: [...entry.flows.map(f => `${f.id} ${f.name}`), ...entry.routes].join(' '),
      patch: { ...pagePatch('flows'), file: `${entry.service}/${entry.path}` },
    })
  }

  for (const team of map.teams ?? []) {
    const ownedServices = map.services.filter(s => s.teamId === team.id)
    entries.push({
      type: 'team',
      label: team.name,
      sublabel: `team · owns ${plural(ownedServices.length, 'service')}`,
      haystack: `${(team.githubTeams ?? []).join(' ')} ${ownedServices.map(s => s.name).join(' ')}`,
      patch: { ...pagePatch('ownership'), team: team.id },
    })
  }

  for (const area of map.areas ?? []) {
    entries.push({
      type: 'area',
      label: area.name,
      sublabel: `${area.kind === 'product' ? 'product area' : 'platform capability'} · ${area.description}`,
      haystack: `${area.id} ${area.codeLocations.map(l => `${l.repo} ${l.globs.join(' ')}`).join(' ')}`,
      patch: { ...pagePatch('areas'), area: area.id },
    })
    for (const g of area.glossary) {
      entries.push({
        type: 'term',
        label: g.term,
        sublabel: `${area.name} · glossary`,
        haystack: `${g.definition} ${g.anchor?.symbol ?? ''}`,
        patch: { ...pagePatch('areas'), area: area.id, term: g.term },
      })
    }
  }

  for (const ext of map.externals ?? []) {
    entries.push({
      type: 'external',
      label: ext.name,
      sublabel: `external · ${ext.category}`,
      haystack: `${ext.description} ${ext.usedBy.map(u => u.service).join(' ')}`,
      patch: pagePatch('microservices'),
    })
  }

  for (const entry of flags.values()) {
    entries.push({
      type: 'flag',
      label: entry.name,
      sublabel: `${entry.kind} flag · gates ${plural(entry.flows.length, 'flow')}`,
      haystack: entry.flows.map(f => `${f.id} ${f.name}`).join(' '),
      patch: { ...pagePatch('flows'), flag: entry.name },
    })
  }

  return entries
}

/**
 * Token-AND substring matching, dependency-free. Every whitespace-separated
 * query token must appear somewhere; entries are ranked by where the tokens
 * hit (label prefix > label > sublabel > haystack), then by type, then by
 * label length (shorter = more exact).
 */
export function searchEntries(index: SearchEntry[], query: string, limit = 40): SearchEntry[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!tokens.length) return []

  const scored: Array<{ entry: SearchEntry; score: number }> = []
  for (const entry of index) {
    const label = entry.label.toLowerCase()
    const sublabel = entry.sublabel.toLowerCase()
    const haystack = entry.haystack.toLowerCase()
    let score = 0
    let ok = true
    for (const t of tokens) {
      if (label.startsWith(t)) score += 3
      else if (label.includes(t)) score += 2
      else if (sublabel.includes(t)) score += 1
      else if (haystack.includes(t)) score += 0.5
      else { ok = false; break }
    }
    if (ok) scored.push({ entry, score })
  }

  scored.sort((a, b) =>
    b.score - a.score
    || TYPE_ORDER[a.entry.type] - TYPE_ORDER[b.entry.type]
    || a.entry.label.length - b.entry.label.length,
  )
  return scored.slice(0, limit).map(s => s.entry)
}
