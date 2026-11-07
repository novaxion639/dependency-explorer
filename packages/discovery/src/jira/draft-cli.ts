import * as fs from 'node:fs'
import * as path from 'node:path'
import { catalogEntryOf } from './catalog'
import { isOpenBug } from './fields'
import { readJiraSnapshot } from './snapshot'

const FETCH_SCRIPT = 'pnpm discover:jira:fetch'

const HELP = `usage: pnpm discover:jira:draft [--snapshot <dir>]

Prints draft rows for packages/data/src/feature-areas.ts, one per Feature Area label of a Jira snapshot
(the latest under packages/discovery/.jira-snapshots/, or --snapshot). Fill in each \`area\`, then paste the rows.`

export function snapshotDirOf(argv: string[], home: string): string | null {
  const flagAt = argv.indexOf('--snapshot')
  const given = flagAt >= 0 ? argv[flagAt + 1] : undefined
  if (given) {
    return path.resolve(given)
  }
  const latest = fs.existsSync(home)
    ? fs
        .readdirSync(home, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
        .pop()
    : undefined
  return latest === undefined ? null : path.join(home, latest)
}

const quoted = (value: string): string => `'${value.replace(/[\\']/g, '\\$&')}'`

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

const byTribeThenLabel = (a: { tribe: string | null; label: string }, b: { tribe: string | null; label: string }): number => {
  if (a.tribe !== b.tribe) {
    return a.tribe === null ? 1 : b.tribe === null ? -1 : compare(a.tribe, b.tribe)
  }
  return compare(a.label, b.label)
}

export async function runDraftCli(argv: string[], snapshotDir: string | null): Promise<number> {
  if (argv.includes('--help')) {
    console.log(HELP)
    return 0
  }
  if (snapshotDir === null) {
    console.error(`No Jira snapshot found: run \`${FETCH_SCRIPT}\` first`)
    return 1
  }
  let snapshot: ReturnType<typeof readJiraSnapshot>
  try {
    snapshot = readJiraSnapshot(snapshotDir)
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    return 1
  }
  const siteStatuses = new Set(snapshot.statuses)
  const openBugs = snapshot.bugs.filter((bug) => isOpenBug(bug, siteStatuses))
  const labels = new Set([...snapshot.featureAreaLabels, ...snapshot.bugs.map((bug) => bug.featureArea).filter((label) => label !== null)])
  const rows = [...labels].map((label) => {
    const entry = catalogEntryOf(label)
    return { label, tribe: entry?.tribe ?? null, catalog: entry?.name ?? 'none', open: openBugs.filter((bug) => bug.featureArea === label).length }
  })
  for (const { label, tribe, catalog, open } of rows.sort(byTribeThenLabel)) {
    console.log(`{ label: ${quoted(label)}, tribe: ${tribe === null ? 'null' : quoted(tribe)}, area: null }, // catalog: ${catalog}, ${open} open BRs`)
  }
  return 0
}
