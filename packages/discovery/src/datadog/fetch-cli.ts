import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { HttpStatus } from '../net/retry'
import { datadogClient } from './client'
import { METRIC_KEYS } from './scope'
import { fetchDatadogSnapshot, writeDatadogSnapshot } from './snapshot'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DEFAULT_SITE = 'datadoghq.eu'
const REFUSED = [401, 403]

const HELP = `usage: pnpm discover:datadog:fetch [--out <dir>]

Reads a Datadog snapshot into packages/discovery/.datadog-snapshots/<YYYY-MM-DD>/ (or --out).
Environment: DATADOG_API_KEY, DATADOG_APP_KEY, DD_SITE (default ${DEFAULT_SITE}).
The application key needs these read scopes:
  monitors_read, slos_read, teams_read, incident_read, timeseries_query, events_read`

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
  try {
    const snapshot = await fetchDatadogSnapshot(datadogClient({ fetch: logged, site, apiKey, appKey }), now)
    writeDatadogSnapshot(outDir, snapshot)
    const metricsRead = METRIC_KEYS.filter((key) => snapshot.metrics[key] !== null).length
    console.error(
      `monitors ${snapshot.monitors.length}, teams ${snapshot.teams.length}, slos ${snapshot.slos.length}, incidents ${snapshot.incidents.length}, ` +
        `metrics ${metricsRead} of ${METRIC_KEYS.length}, events ${snapshot.events.items.length}${snapshot.events.capped ? ' (capped)' : ''}`,
    )
    console.error(`snapshot written to ${outDir}`)
    return 0
  } catch (e) {
    if (e instanceof HttpStatus && REFUSED.includes(e.status)) {
      console.error(`Datadog refused the keys (HTTP ${e.status})`)
    } else {
      console.error(`Datadog fetch failed: ${e instanceof Error ? e.message : String(e)}`)
    }
    return 1
  }
}
