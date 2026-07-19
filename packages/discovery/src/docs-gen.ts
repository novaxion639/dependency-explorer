import type { ConnectivityMap } from '@dependency-explorer/schema'
import { getFlowDomains } from '@dependency-explorer/data'

/**
 * Generated sections of the inventory docs — rendered from the dataset so
 * flow counts and per-domain attribution structurally cannot go stale. The
 * generator owns ONLY the text between its markers; analysis prose around
 * them stays hand-authored (the action-level taxonomy in
 * planning-actions-coverage has no schema representation and never will be
 * generated). `pnpm docs:gen` rewrites the sections; the docs-gen test fails
 * CI whenever a committed section drifts from the dataset.
 */

export const MARKERS = {
  begin: (name: string) => `<!-- GENERATED:${name} BEGIN — run \`pnpm docs:gen\`, do not edit inside -->`,
  end: (name: string) => `<!-- GENERATED:${name} END -->`,
}

export function renderFlowInventorySection(map: ConnectivityMap): string {
  const domains = map.domains ?? []
  const byDomain = new Map<string, string[]>(domains.map(d => [d.id, []]))
  for (const flow of map.flows) {
    for (const d of getFlowDomains(flow, domains)) {
      byDomain.get(d.id)!.push(flow.id)
    }
  }
  const rows = domains
    .map(d => ({ d, flows: byDomain.get(d.id)! }))
    .sort((a, b) => b.flows.length - a.flows.length)
  const zero = rows.filter(r => r.flows.length === 0)

  const lines = [
    `**${map.flows.length} modelled flows** across ${map.services.length} services — every flow carries a code layer and a trigger.`,
    '',
    '| Domain | Flows | Ids |',
    '|---|---|---|',
    ...rows.map(({ d, flows }) =>
      `| ${d.name} | ${flows.length} | ${flows.length ? flows.map(f => `\`${f}\``).join(' ') : '—'} |`),
    '',
    zero.length
      ? `Domains with zero flows: ${zero.map(r => r.d.name).join(', ')}.`
      : 'Every domain has at least one modelled flow.',
  ]
  return lines.join('\n')
}

export function renderPlanningCoverageSection(map: ConnectivityMap): string {
  // The planning surface has no domain of its own (it spans scheduling +
  // the monolith core) — the derivable stat is which of THIS DOC's ✅ flow
  // ids still exist in the dataset, so a renamed/retired flow goes stale
  // loudly instead of silently.
  const scheduling = map.flows.filter(f => getFlowDomains(f, map.domains ?? []).some(d => d.id === 'scheduling'))
  return [
    `**The dependency graph models ${map.flows.length} flows** — ${scheduling.length} touch the scheduling domain: `
      + scheduling.map(f => `\`${f.id}\``).join(' '),
    '',
    '_The action-level table below is hand-maintained — sub-flow UI actions have no schema representation. Every ✅ flow id it cites is checked against the dataset by the docs-gen test._',
  ].join('\n')
}

/** Flow ids cited as ✅ in a hand-maintained doc — verified to exist by the gate. */
export function extractCitedFlowIds(content: string): string[] {
  return [...new Set([...content.matchAll(/✅ `([a-z0-9-]+)`/g)].map(m => m[1]!))]
}

/** Replace the named generated section inside a document. Throws if markers are missing. */
export function applyGenerated(content: string, name: string, section: string): string {
  const begin = MARKERS.begin(name)
  const end = MARKERS.end(name)
  const b = content.indexOf(begin)
  const e = content.indexOf(end)
  if (b === -1 || e === -1 || e < b) {
    throw new Error(`markers for generated section "${name}" not found`)
  }
  return content.slice(0, b + begin.length) + '\n' + section + '\n' + content.slice(e)
}

/** Extract the current content of a named generated section (for the drift gate). */
export function extractGenerated(content: string, name: string): string | null {
  const begin = MARKERS.begin(name)
  const end = MARKERS.end(name)
  const b = content.indexOf(begin)
  const e = content.indexOf(end)
  if (b === -1 || e === -1 || e < b) return null
  return content.slice(b + begin.length, e).trim()
}
