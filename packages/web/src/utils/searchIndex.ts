import type { ConnectivityMap, MonolithRoute, Resource } from '@dependency-explorer/data'
import type { UrlState } from '../hooks/useUrlState'
import { edgeKey, servicePage } from '../hooks/useUrlState'
import { buildFlagRegistry } from './flagRegistry'
import { buildFileIndex } from './fileIndex'

export type SearchResultType = 'service' | 'endpoint' | 'connection' | 'flow' | 'area' | 'term' | 'external' | 'team' | 'resource' | 'flag' | 'file'

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
  service: 0, endpoint: 1, connection: 2, flow: 3, area: 4, term: 5, external: 6, team: 7, resource: 8, flag: 9, file: 10,
}

// Choosing a result fully describes the target view: modal/popup params are
// reset explicitly so the landing state never mixes with whatever was open.
const CLOSE_OVERLAYS: Partial<UrlState> = { edge: null, drawer: null, ep: null, flows: null, flow: null, flag: null, file: null, resource: null, area: null, term: null, blast: null, unit: null, chapter: null }

export function buildSearchIndex(map: ConnectivityMap, routes: MonolithRoute[] = [], resources: Resource[] = []): SearchEntry[] {
  const entries: SearchEntry[] = []

  for (const svc of map.services) {
    entries.push({
      type: 'service',
      label: svc.name,
      sublabel: svc.description,
      haystack: `${svc.type} ${(svc.tags ?? []).join(' ')}`,
      patch: { ...CLOSE_OVERLAYS, s: svc.name, page: servicePage(svc.name) },
    })
    for (const ep of svc.endpoints) {
      entries.push({
        type: 'endpoint',
        label: `${ep.method} ${ep.path}`,
        sublabel: `${svc.name} · ${ep.description}`,
        haystack: `${ep.id} ${ep.useCase}`,
        patch: { ...CLOSE_OVERLAYS, s: svc.name, page: servicePage(svc.name), drawer: svc.name, ep: ep.id },
      })
    }
  }

  for (const r of resources) {
    entries.push({
      type: 'resource',
      label: r.name,
      sublabel: `${r.kind} · ${r.store}${r.owner ? ` · ${r.owner}` : ''}`,
      haystack: r.id,
      patch: { ...CLOSE_OVERLAYS, page: 'resources', resource: r.id },
    })
  }

  for (const conn of map.connections) {
    entries.push({
      type: 'connection',
      label: `${conn.from} → ${conn.to}`,
      sublabel: `${conn.communicationType}/${conn.protocol} · ${conn.description}`,
      haystack: `${conn.sdkPackage} ${(conn.usedEndpoints ?? []).join(' ')}`,
      patch: { ...CLOSE_OVERLAYS, s: conn.from, page: servicePage(conn.from), edge: edgeKey(conn.from, conn.to, conn.protocol) },
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
      patch: { ...CLOSE_OVERLAYS, page: 'flows', flow: flow.id },
    })
  }

  // Reverse code→flows index — derived from codeUnits[].path, zero authored data
  for (const entry of buildFileIndex(map, routes).values()) {
    entries.push({
      type: 'file',
      label: entry.path,
      sublabel: `${entry.service} · touched by ${entry.flows.length} flow${entry.flows.length === 1 ? '' : 's'}${entry.routes.length ? ` · serves ${entry.routes.length} route${entry.routes.length === 1 ? '' : 's'}` : ''}`,
      haystack: [...entry.flows.map(f => `${f.id} ${f.name}`), ...entry.routes].join(' '),
      patch: { ...CLOSE_OVERLAYS, page: 'flows', file: `${entry.service}/${entry.path}` },
    })
  }

  for (const team of map.teams ?? []) {
    const ownedServices = map.services.filter(s => s.teamId === team.id)
    entries.push({
      type: 'team',
      label: team.name,
      sublabel: `team · owns ${ownedServices.length} service${ownedServices.length === 1 ? '' : 's'}`,
      haystack: `${(team.githubTeams ?? []).join(' ')} ${ownedServices.map(s => s.name).join(' ')}`,
      patch: { ...CLOSE_OVERLAYS, page: 'ownership', team: team.id, s: null },
    })
  }

  for (const area of map.areas ?? []) {
    entries.push({
      type: 'area',
      label: area.name,
      sublabel: `${area.kind === 'product' ? 'product area' : 'platform capability'} · ${area.description}`,
      haystack: `${area.id} ${area.codeLocations.map(l => `${l.repo} ${l.globs.join(' ')}`).join(' ')}`,
      patch: { ...CLOSE_OVERLAYS, page: 'areas', area: area.id, s: null },
    })
    for (const g of area.glossary) {
      entries.push({
        type: 'term',
        label: g.term,
        sublabel: `${area.name} · glossary`,
        haystack: `${g.definition} ${g.anchor?.symbol ?? ''}`,
        patch: { ...CLOSE_OVERLAYS, page: 'areas', area: area.id, term: g.term, s: null },
      })
    }
  }

  for (const ext of map.externals ?? []) {
    entries.push({
      type: 'external',
      label: ext.name,
      sublabel: `external · ${ext.category}`,
      haystack: `${ext.description} ${ext.usedBy.map(u => u.service).join(' ')}`,
      patch: { ...CLOSE_OVERLAYS, page: 'microservices', s: null },
    })
  }

  for (const entry of buildFlagRegistry(map).values()) {
    entries.push({
      type: 'flag',
      label: entry.name,
      sublabel: `${entry.kind} flag · gates ${entry.flows.length} flow${entry.flows.length === 1 ? '' : 's'}`,
      haystack: entry.flows.map(f => `${f.id} ${f.name}`).join(' '),
      patch: { ...CLOSE_OVERLAYS, page: 'flows', flag: entry.name },
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
