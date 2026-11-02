import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { datadogClient, Refused } from './client'
import { METRIC_KEYS } from './scope'
import { fetchDatadogSnapshot, writeDatadogSnapshot } from './snapshot'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DEFAULT_SITE = 'datadoghq.eu'

const HELP = `usage: pnpm discover:datadog:fetch [--out <dir>]

Reads a Datadog snapshot into packages/discovery/.datadog-snapshots/<YYYY-MM-DD>/ (or --out).
Environment: DATADOG_API_KEY, DATADOG_APP_KEY, DD_SITE (default ${DEFAULT_SITE}).
The application key needs these read scopes:
  monitors_read, slos_read, teams_read, incident_read, timeseries_query, events_read`

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e))

const requestLine = (input: Parameters<typeof fetch>[0], init?: RequestInit): string =>
  `${init?.method ?? 'GET'} ${new URL(input instanceof Request ? input.url : input).pathname}`

export async function runFetchCli(argv: string[], env: Record<string, string | undefined>, fetch: typeof globalThis.fetch, now = new Date()): Promise<number> {
  if (argv.includes('--help')) {
    console.log(HELP)
    return 0
  }
  const apiKey = env.DATADOG_API_KEY
  const appKey = env.DATADOG_APP_KEY
  if (!apiKey || !appKey) {
    console.error(`${apiKey ? 'DATADOG_APP_KEY' : 'DATADOG_API_KEY'} is not set`)
    return 1
  }
  const outAt = argv.indexOf('--out')
  const outDir = path.resolve((outAt >= 0 && argv[outAt + 1]) || path.join(PACKAGE_ROOT, '.datadog-snapshots', now.toISOString().slice(0, 10)))
  const site = env.DD_SITE || DEFAULT_SITE

  const logged: typeof globalThis.fetch = (input, init) => {
    console.error(`  ${requestLine(input, init)}`)
    return fetch(input, init)
  }
  let fetched: Awaited<ReturnType<typeof fetchDatadogSnapshot>>
  try {
    fetched = await fetchDatadogSnapshot(datadogClient({ fetch: logged, site, apiKey, appKey }), now)
  } catch (e) {
    console.error(e instanceof Refused ? e.message : `Datadog fetch failed: ${messageOf(e)}`)
    return 1
  }
  const { snapshot, failures } = fetched
  try {
    writeDatadogSnapshot(outDir, snapshot)
  } catch (e) {
    console.error(messageOf(e))
    return 1
  }
  for (const failure of failures) {
    console.error(`  metric ${failure.key} unavailable: ${failure.cause}`)
  }
  const metricsRead = METRIC_KEYS.filter((key) => snapshot.metrics[key] !== null).length
  console.error(
    `monitors ${snapshot.monitors.length}, teams ${snapshot.teams.length}, slos ${snapshot.slos.length}, incidents ${snapshot.incidents.length}, ` +
      `metrics ${metricsRead} of ${METRIC_KEYS.length}, events ${snapshot.events.items.length}${snapshot.events.capped ? ' (capped)' : ''}`,
  )
  console.error(`snapshot written to ${outDir}`)
  return 0
}
