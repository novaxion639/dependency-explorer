import type { ConnectivityMap } from '@dependency-explorer/schema'
import { getFlowAreas } from '@dependency-explorer/data'

/**
 * Generated sections of the inventory docs — rendered from the dataset so
 * flow counts and per-area attribution structurally cannot go stale. The
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
  const productAreas = (map.areas ?? []).filter(a => a.kind === 'product')
  const byArea = new Map<string, string[]>(productAreas.map(a => [a.id, []]))
  const platformOwned: string[] = []
  for (const flow of map.flows) {
    const bucket = byArea.get(flow.primaryArea ?? '')
    if (bucket) {
      bucket.push(flow.id)
    } else {
      platformOwned.push(flow.id)
    }
  }
  const rows = productAreas
    .map(area => ({ area, flows: byArea.get(area.id) ?? [] }))
    .sort((a, b) => b.flows.length - a.flows.length)
  const empty = rows.filter(r => r.flows.length === 0)
  return [
    `**${map.flows.length} modelled flows** across ${map.services.length} services — every flow carries a code layer, a trigger and a primary area.`,
    '',
    '| Product area | Flows | Ids |',
    '|---|---|---|',
    ...rows.map(({ area, flows }) =>
      `| ${area.name} | ${flows.length} | ${flows.length ? flows.map(f => `\`${f}\``).join(' ') : '—'} |`),
    '',
    empty.length
      ? `Product areas with no flow yet: ${empty.map(r => r.area.name).join(', ')}.`
      : 'Every product area has at least one modelled flow.',
    ...(platformOwned.length
      ? ['', `Flows owned by a platform capability: ${platformOwned.map(f => `\`${f}\``).join(' ')}.`]
      : []),
  ].join('\n')
}

export function renderPlanningCoverageSection(map: ConnectivityMap): string {
  const areas = map.areas ?? []
  const planning = map.flows.filter(f => getFlowAreas(f, areas).some(a => a.id === 'planning'))
  return [
    `**The dependency graph models ${map.flows.length} flows** — ${planning.length} touch the planning area: `
      + planning.map(f => `\`${f.id}\``).join(' '),
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
