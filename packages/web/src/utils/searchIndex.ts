import type { ConnectivityMap } from '@dependency-explorer/data'
import type { UrlState } from '../hooks/useUrlState'
import { edgeKey } from '../hooks/useUrlState'
import { buildFlagRegistry } from './flagRegistry'
import { buildFileIndex } from './fileIndex'

export type SearchResultType = 'service' | 'endpoint' | 'connection' | 'flow' | 'domain' | 'team' | 'infra' | 'flag' | 'file'

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
  service: 0, endpoint: 1, connection: 2, flow: 3, domain: 4, team: 5, infra: 6, flag: 7, file: 8,
}

// Choosing a result fully describes the target view: modal/popup params are
// reset explicitly so the landing state never mixes with whatever was open.
const CLOSE_OVERLAYS: Partial<UrlState> = { edge: null, drawer: null, ep: null, flows: null, flow: null, flag: null, file: null }

export function buildSearchIndex(map: ConnectivityMap): SearchEntry[] {
  const entries: SearchEntry[] = []

  for (const svc of map.services) {
    entries.push({
      type: 'service',
      label: svc.name,
      sublabel: svc.description,
      haystack: `${svc.type} ${(svc.tags ?? []).join(' ')}`,
      patch: { ...CLOSE_OVERLAYS, s: svc.name, view: 'services' },
    })
    for (const ep of svc.endpoints) {
      entries.push({
        type: 'endpoint',
        label: `${ep.method} ${ep.path}`,
        sublabel: `${svc.name} · ${ep.description}`,
        haystack: `${ep.id} ${ep.useCase}`,
        patch: { ...CLOSE_OVERLAYS, s: svc.name, view: 'services', drawer: svc.name, ep: ep.id },
      })
    }
    for (const db of svc.databases ?? []) {
      entries.push({
        type: 'infra',
        label: db.name,
        sublabel: `${db.type} · ${svc.name}`,
        haystack: db.description ?? '',
        patch: { ...CLOSE_OVERLAYS, s: svc.name, view: 'services' },
      })
    }
  }

  for (const conn of map.connections) {
    entries.push({
      type: 'connection',
      label: `${conn.from} → ${conn.to}`,
      sublabel: `${conn.communicationType}/${conn.protocol} · ${conn.description}`,
      haystack: `${conn.sdkPackage} ${(conn.usedEndpoints ?? []).join(' ')}`,
      patch: { ...CLOSE_OVERLAYS, s: conn.from, view: 'services', edge: edgeKey(conn.from, conn.to, conn.protocol) },
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
      patch: { ...CLOSE_OVERLAYS, flow: flow.id },
    })
  }

  // Reverse code→flows index — derived from codeUnits[].path, zero authored data
  for (const entry of buildFileIndex(map).values()) {
    entries.push({
      type: 'file',
      label: entry.path,
      sublabel: `${entry.service} · touched by ${entry.flows.length} flow${entry.flows.length === 1 ? '' : 's'}`,
      haystack: entry.flows.map(f => `${f.id} ${f.name}`).join(' '),
      patch: { ...CLOSE_OVERLAYS, file: `${entry.service}/${entry.path}` },
    })
  }

  for (const team of map.teams ?? []) {
    const ownedServices = map.services.filter(s => s.teamId === team.id)
    entries.push({
      type: 'team',
      label: team.name,
      sublabel: `team · owns ${ownedServices.length} service${ownedServices.length === 1 ? '' : 's'}`,
      haystack: `${(team.githubTeams ?? []).join(' ')} ${ownedServices.map(s => s.name).join(' ')}`,
      patch: { ...CLOSE_OVERLAYS, view: 'teams', team: team.id, s: null },
    })
  }

  for (const domain of map.domains ?? []) {
    entries.push({
      type: 'domain',
      label: domain.name,
      sublabel: `domain · ${domain.serviceNames.length} services`,
      haystack: domain.serviceNames.join(' '),
      patch: { ...CLOSE_OVERLAYS, view: 'services', domain: domain.id },
    })
  }

  for (const entry of buildFlagRegistry(map).values()) {
    entries.push({
      type: 'flag',
      label: entry.name,
      sublabel: `${entry.kind} flag · gates ${entry.flows.length} flow${entry.flows.length === 1 ? '' : 's'}`,
      haystack: entry.flows.map(f => `${f.id} ${f.name}`).join(' '),
      patch: { ...CLOSE_OVERLAYS, flag: entry.name },
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
