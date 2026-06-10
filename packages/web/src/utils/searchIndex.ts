import type { ConnectivityMap } from '@dependency-explorer/data'
import type { UrlState } from '../hooks/useUrlState'
import { edgeKey } from '../hooks/useUrlState'

export type SearchResultType = 'service' | 'endpoint' | 'connection' | 'flow' | 'domain' | 'infra'

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
  service: 0, endpoint: 1, connection: 2, flow: 3, domain: 4, infra: 5,
}

// Choosing a result fully describes the target view: modal/popup params are
// reset explicitly so the landing state never mixes with whatever was open.
const CLOSE_OVERLAYS: Partial<UrlState> = { edge: null, drawer: null, ep: null, flows: null, flow: null }

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
      haystack: flow.steps.map(s => `${s.from} ${s.to} ${s.action}`).join(' '),
      patch: { ...CLOSE_OVERLAYS, flow: flow.id },
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
