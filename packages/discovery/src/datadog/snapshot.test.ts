import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { datadogClient } from './client'
import { runFetchCli } from './fetch-cli'
import { fetchDatadogSnapshot, readDatadogSnapshot, SnapshotFormatError, writeDatadogSnapshot, type DatadogSnapshot } from './snapshot'

const API_KEY = 'fake-api-key-0123456789'
const APP_KEY = 'fake-app-key-9876543210'
const ENV = { DATADOG_API_KEY: API_KEY, DATADOG_APP_KEY: APP_KEY }
const NOW = new Date('2026-11-02T10:30:00Z')
const SENTINEL = /SENTINEL-[A-Z-]+/

type Call = { method: string; path: string; params: URLSearchParams; body: unknown; headers: Headers; host: string; signal: unknown }

const fixture = (name: string): unknown =>
  JSON.parse(fs.readFileSync(new URL(`./__fixtures__/${name}.json`, import.meta.url), 'utf8'))

const answer = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers })

const refused = () => answer({ errors: ['Forbidden'] }, 403)

function fakeDatadog(options: { overrides?: Record<string, () => Response>; eventPages?: number; failures?: number[] } = {}) {
  const { overrides = {}, eventPages = 2 } = options
  const failures = [...(options.failures ?? [])]
  const calls: Call[] = []
  let eventPage = 0
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null
    calls.push({ method: init?.method ?? 'GET', path: url.pathname, params: url.searchParams, body, headers: new Headers(init?.headers), host: url.host, signal: init?.signal })
    const failure = failures.shift()
    if (failure !== undefined) {
      return answer({ errors: ['fictitious'] }, failure)
    }
    const override = overrides[url.pathname]
    if (override) {
      return override()
    }
    const page = url.searchParams.get('page') ?? url.searchParams.get('page[number]')
    switch (url.pathname) {
      case '/api/v1/validate':
        return answer(fixture('validate'))
      case '/api/v1/monitor/search':
        return answer(fixture(`monitor-search-page-${page}`))
      case '/api/v2/team':
        return answer(fixture(`team-page-${page}`))
      case '/api/v1/slo/search':
        return answer(fixture('slo-search'))
      case '/api/v2/incidents':
        return answer(fixture('incidents'))
      case '/api/v1/query':
        return answer(fixture(url.searchParams.get('query')?.includes('sqsdlq') ? 'query-error' : 'query'))
      case '/api/v2/events/search':
        eventPage++
        return answer(fixture(eventPage < eventPages ? 'events-page' : 'events-last-page'))
      default:
        return answer({ errors: ['Not found'] }, 404)
    }
  }
  return { fetch, calls }
}

const clientOf = (fetch: typeof globalThis.fetch, sleeps: number[] = []) =>
  datadogClient({ fetch, site: 'datadoghq.eu', apiKey: API_KEY, appKey: APP_KEY, wire: { sleep: (ms) => Promise.resolve(void sleeps.push(ms)) } })

describe('fetchDatadogSnapshot', () => {
  it('validates first, then reads metadata, then series scoped to the prod services', async () => {
    const { fetch, calls } = fakeDatadog()
    const { snapshot } = await fetchDatadogSnapshot(clientOf(fetch), NOW)

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET /api/v1/validate',
      'GET /api/v1/monitor/search',
      'GET /api/v1/monitor/search',
      'GET /api/v2/team',
      'GET /api/v2/team',
      'GET /api/v1/slo/search',
      'GET /api/v2/incidents',
      ...Array.from({ length: 11 }, () => 'GET /api/v1/query'),
      'POST /api/v2/events/search',
      'POST /api/v2/events/search',
    ])
    const queries = calls.filter((c) => c.path === '/api/v1/query').map((c) => c.params.get('query') ?? '')
    const named = new Set(queries.flatMap((q) => q.replaceAll('-prod', '').match(/svc[\w-]*/g) ?? []))
    expect([...named].sort()).toEqual(['svc-alpha', 'svc-beta'])
    expect(queries.filter((q) => !q.includes('sqsdlq')).every((q) => q.includes('svc-alpha') && q.includes('svc-beta'))).toBe(true)
    const [events] = calls.filter((c) => c.path === '/api/v2/events/search')
    expect(events?.body).toMatchObject({
      filter: { query: 'status:(error OR warn) (env:prod OR environment:prod) (team:(alpha-squad OR beta-squad) OR service:(svc-alpha OR svc-beta) OR project:(svc-alpha OR svc-beta))' },
    })
    expect(calls.every((c) => c.signal instanceof AbortSignal)).toBe(true)
    expect(snapshot.meta).toEqual({ fetchedAt: NOW.toISOString(), site: 'datadoghq.eu', from: Date.parse('2026-10-12T10:00:00Z') / 1000, to: Date.parse('2026-11-02T10:00:00Z') / 1000 })
    expect(snapshot.metrics.api_count).toEqual([{ tag_set: ['name:svc-alpha-prod'], pointlist: [[1761897600000, 12], [1761901200000, null]] }])
    expect(snapshot.metrics.dlq).toBeNull()
    expect(snapshot.incidents).toEqual([
      { id: 'inc-0001', public_id: 117, title: 'svc-alpha checkout degraded', severity: 'SEV-2', created: '2026-10-30T09:00:00.000000+00:00', services: ['svc-alpha'] },
    ])
  })

  it('reads every monitor and team page', async () => {
    const { fetch, calls } = fakeDatadog()
    const { snapshot } = await fetchDatadogSnapshot(clientOf(fetch), NOW)

    expect(calls.filter((c) => c.path === '/api/v1/monitor/search').map((c) => c.params.get('page'))).toEqual(['0', '1'])
    expect(calls.filter((c) => c.path === '/api/v2/team').map((c) => c.params.get('page[number]'))).toEqual(['0', '1'])
    expect(snapshot.monitors.map((m) => m.id)).toEqual([1001, 1002, 1003])
    expect(snapshot.monitors[2]).toEqual({ id: 1003, name: 'beta latency', tags: ['Project:svc-beta', 'Environment:Prod', 'team:beta-squad'], overall_state: 'Warn' })
    expect(snapshot.teams).toEqual([
      { id: 'team-0001', handle: 'alpha-squad', name: 'Alpha Squad' },
      { id: 'team-0002', handle: 'beta-squad', name: 'Beta Squad' },
    ])
    expect(snapshot.slos.map((s) => s.id)).toEqual(['slo-0001', 'slo-0002'])
    expect(snapshot.slos[0]).toMatchObject({ target: 99.9, value: 99.95 })
  })

  it('caps events at 4 pages of 500 and records capped', async () => {
    const { fetch, calls } = fakeDatadog({ eventPages: 6 })
    const { snapshot } = await fetchDatadogSnapshot(clientOf(fetch), NOW)

    const pages = calls.filter((c) => c.path === '/api/v2/events/search').map((c) => c.body)
    expect(pages).toHaveLength(4)
    expect(pages[0]).toMatchObject({ page: { limit: 500 }, sort: '-timestamp', filter: { from: '2026-10-26T10:30:00.000Z', to: NOW.toISOString() } })
    expect(pages[1]).toMatchObject({ page: { limit: 500, cursor: 'fake-cursor' } })
    expect(snapshot.events).toEqual({ items: Array.from({ length: 4 }, () => ({ monitor_id: 1001, ts: 1761897600, status: 'error' })), capped: true })
  })

  it('records events uncapped when the last page names no cursor', async () => {
    const { fetch } = fakeDatadog()
    const { snapshot } = await fetchDatadogSnapshot(clientOf(fetch), NOW)

    expect(snapshot.events).toEqual({
      items: [
        { monitor_id: 1001, ts: 1761897600, status: 'error' },
        { monitor_id: 1003, ts: 1761894000, status: 'warn' },
      ],
      capped: false,
    })
  })

  it('keeps no monitor message, query or incident body', async () => {
    const { fetch } = fakeDatadog()
    const { snapshot } = await fetchDatadogSnapshot(clientOf(fetch), NOW)

    expect(JSON.stringify(fixture('monitor-search-page-0'))).toMatch(SENTINEL)
    expect(JSON.stringify(snapshot)).not.toMatch(SENTINEL)
  })

  it('retries a retried status after the growing wait and sends the keys as headers', async () => {
    const sleeps: number[] = []
    const { fetch, calls } = fakeDatadog({ failures: [503] })
    await fetchDatadogSnapshot(clientOf(fetch, sleeps), NOW)

    expect(sleeps).toEqual([2000])
    expect(calls.slice(0, 2).map((c) => c.path)).toEqual(['/api/v1/validate', '/api/v1/validate'])
    expect(calls[0]?.host).toBe('api.datadoghq.eu')
    expect(calls[0]?.headers.get('DD-API-KEY')).toBe(API_KEY)
    expect(calls[0]?.headers.get('DD-APPLICATION-KEY')).toBe(APP_KEY)
  })

  it('reports each metric it could not read, with its cause, and keeps the causes out of the snapshot', async () => {
    const { fetch } = fakeDatadog()
    const { snapshot, failures } = await fetchDatadogSnapshot(clientOf(fetch), NOW)

    expect(failures).toEqual([{ key: 'dlq', cause: 'fictitious refusal' }])
    expect(JSON.stringify(snapshot)).not.toContain('fictitious refusal')
  })

  it('names the call Datadog refused among the series', async () => {
    const { fetch } = fakeDatadog({ overrides: { '/api/v1/query': refused } })
    const { snapshot, failures } = await fetchDatadogSnapshot(clientOf(fetch), NOW)

    expect(failures).toHaveLength(11)
    expect(new Set(failures.map((f) => f.cause))).toEqual(new Set(['Datadog refused GET /api/v1/query (HTTP 403)']))
    expect(Object.values(snapshot.metrics).every((series) => series === null)).toBe(true)
  })

  it('reads only the unscoped DLQ series and no events without a prod service', async () => {
    const { fetch, calls } = fakeDatadog({
      overrides: {
        '/api/v1/monitor/search': () => answer({ monitors: [], metadata: { page_count: 1 } }),
        '/api/v1/slo/search': () => answer({ data: { attributes: { slos: [] } } }),
      },
    })
    const { snapshot } = await fetchDatadogSnapshot(clientOf(fetch), NOW)

    const queries = calls.filter((c) => c.path === '/api/v1/query').map((c) => c.params.get('query') ?? '')
    expect(queries).toHaveLength(1)
    expect(queries[0]).toContain('sqsdlq:true')
    expect(calls.some((c) => c.path === '/api/v2/events/search')).toBe(false)
    expect(snapshot.events).toEqual({ items: [], capped: false })
    expect(snapshot.metrics.api_count).toBeNull()
  })

  it('ends the event pages on an empty cursor', async () => {
    const { fetch, calls } = fakeDatadog({ overrides: { '/api/v2/events/search': () => answer({ data: [], meta: { page: { after: '' } } }) } })
    const { snapshot } = await fetchDatadogSnapshot(clientOf(fetch), NOW)

    expect(calls.filter((c) => c.path === '/api/v2/events/search')).toHaveLength(1)
    expect(snapshot.events).toEqual({ items: [], capped: false })
  })

  it('reads SLO tags from all_tags, falling back to tags', async () => {
    const slo = { data: { id: 'slo-0003', attributes: { name: 'svc-epsilon latency', tags: ['service:svc-epsilon', 'env:prod'] } } }
    const { fetch, calls } = fakeDatadog({ overrides: { '/api/v1/slo/search': () => answer({ data: { attributes: { slos: [slo] } } }) } })
    const { snapshot } = await fetchDatadogSnapshot(clientOf(fetch), NOW)

    expect(snapshot.slos).toEqual([{ id: 'slo-0003', name: 'svc-epsilon latency', tags: ['service:svc-epsilon', 'env:prod'], target: null, value: null }])
    expect(calls.find((c) => c.path === '/api/v1/query')?.params.get('query')).toContain('svc-epsilon')
  })

  it('gives up after 5 attempts on a status still failing', async () => {
    const sleeps: number[] = []
    const { fetch } = fakeDatadog({ failures: [429, 429, 429, 429, 429] })

    await expect(fetchDatadogSnapshot(clientOf(fetch, sleeps), NOW)).rejects.toThrow('HTTP 429 on every attempt')
    expect(sleeps).toEqual([2000, 3000, 5000, 9000])
  })
})

describe('writeDatadogSnapshot', () => {
  let root: string
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'datadog-snapshot-'))
  })
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('writes one file per top-level key and reads them back, replacing an older run', async () => {
    const { fetch } = fakeDatadog()
    const { snapshot } = await fetchDatadogSnapshot(clientOf(fetch), NOW)
    const dir = path.join(root, 'snaps', '2026-11-02')
    writeDatadogSnapshot(dir, { ...snapshot, monitors: [] })

    writeDatadogSnapshot(dir, snapshot)

    expect(fs.readdirSync(dir).sort()).toEqual(['events.json', 'incidents.json', 'meta.json', 'metrics.json', 'monitors.json', 'slos.json', 'teams.json'])
    expect(fs.readdirSync(path.dirname(dir))).toEqual(['2026-11-02'])
    expect(readDatadogSnapshot(dir)).toEqual(snapshot)
  })

  it('refuses to read a snapshot from an older fetch, naming the file and the fetch to re-run', async () => {
    const { fetch } = fakeDatadog()
    const { snapshot } = await fetchDatadogSnapshot(clientOf(fetch), NOW)
    const dir = path.join(root, '2026-11-02')
    writeDatadogSnapshot(dir, snapshot)
    fs.writeFileSync(path.join(dir, 'slos.json'), JSON.stringify(snapshot.slos.map(({ target: _, ...older }) => older)))

    expect(() => readDatadogSnapshot(dir)).toThrow(SnapshotFormatError)
    expect(() => readDatadogSnapshot(dir)).toThrow(`${path.join(dir, 'slos.json')} does not match the Datadog snapshot format`)
    expect(() => readDatadogSnapshot(dir)).toThrow('Re-run `pnpm discover:datadog:fetch` for a fresh snapshot.')
  })

  it('reads incidents from a fetch that kept no public id', async () => {
    const { fetch } = fakeDatadog()
    const { snapshot } = await fetchDatadogSnapshot(clientOf(fetch), NOW)
    const dir = path.join(root, '2026-11-02')
    const older = snapshot.incidents.map(({ public_id: _, ...incident }) => incident)
    writeDatadogSnapshot(dir, { ...snapshot, incidents: older })

    expect(readDatadogSnapshot(dir).incidents).toEqual(older)
  })

  it.each([
    ['is missing', (file: string) => fs.rmSync(file), 'ENOENT'],
    ['holds no JSON', (file: string) => fs.writeFileSync(file, '{"from":'), 'JSON'],
  ])('refuses a snapshot whose file %s, naming it and the fetch to re-run', async (_, damage, cause) => {
    const { fetch } = fakeDatadog()
    const { snapshot } = await fetchDatadogSnapshot(clientOf(fetch), NOW)
    const dir = path.join(root, '2026-11-02')
    writeDatadogSnapshot(dir, snapshot)
    const file = path.join(dir, 'meta.json')
    damage(file)

    expect(() => readDatadogSnapshot(dir)).toThrow(SnapshotFormatError)
    expect(() => readDatadogSnapshot(dir)).toThrow(`${file} cannot be read:`)
    expect(() => readDatadogSnapshot(dir)).toThrow(cause)
    expect(() => readDatadogSnapshot(dir)).toThrow('Re-run `pnpm discover:datadog:fetch` for a fresh snapshot.')
  })

  it('refuses a folder holding anything but a snapshot, leaving it intact', async () => {
    const { fetch } = fakeDatadog()
    const { snapshot } = await fetchDatadogSnapshot(clientOf(fetch), NOW)
    fs.writeFileSync(path.join(root, 'notes.txt'), 'keep me')
    fs.mkdirSync(path.join(root, 'meta.json'))

    expect(() => writeDatadogSnapshot(root, snapshot)).toThrow(`${root} holds files other than a Datadog snapshot; nothing written`)
    expect(fs.readdirSync(root).sort()).toEqual(['meta.json', 'notes.txt'])
    expect(fs.readFileSync(path.join(root, 'notes.txt'), 'utf8')).toBe('keep me')
  })

  it('leaves no folder when a write fails', () => {
    const broken: DatadogSnapshot = {
      meta: {
        get fetchedAt(): string {
          throw new Error('unwritable')
        },
        site: 'datadoghq.eu',
        from: 0,
        to: 0,
      },
      monitors: [],
      teams: [],
      slos: [],
      incidents: [],
      metrics: { api_count: null, api_5xx: null, api_4xx: null, api_p95: null, lambda_errors: null, fn_invocations: null, fn_errors: null, apm_hits: null, apm_p95: null, apm_status: null, dlq: null },
      events: { items: [], capped: false },
    }

    expect(() => writeDatadogSnapshot(path.join(root, 'out'), broken)).toThrow('unwritable')
    expect(fs.readdirSync(root)).toEqual([])
  })
})

describe('runFetchCli', () => {
  let root: string
  let printed: string[]
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'datadog-cli-'))
    printed = []
    const capture = (...args: unknown[]) => {
      printed.push(args.map(String).join(' '))
    }
    vi.spyOn(console, 'log').mockImplementation(capture)
    vi.spyOn(console, 'error').mockImplementation(capture)
    vi.spyOn(console, 'warn').mockImplementation(capture)
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => printed.push(String(chunk)) > 0)
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => printed.push(String(chunk)) > 0)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('exits 1 and leaves no folder when validate is refused', async () => {
    const { fetch } = fakeDatadog({ overrides: { '/api/v1/validate': refused } })
    const out = path.join(root, 'snap')

    expect(await runFetchCli(['--out', out], ENV, fetch, NOW)).toBe(1)
    expect(printed.join('\n')).toContain('Datadog refused the keys (HTTP 403)')
    expect(fs.existsSync(out)).toBe(false)
    expect(fs.readdirSync(root)).toEqual([])
  })

  it('names any later call Datadog refused', async () => {
    const { fetch } = fakeDatadog({ overrides: { '/api/v2/incidents': refused } })

    expect(await runFetchCli(['--out', path.join(root, 'snap')], ENV, fetch, NOW)).toBe(1)
    expect(printed.join('\n')).toContain('Datadog refused GET /api/v2/incidents (HTTP 403)')
    expect(printed.join('\n')).not.toContain('refused the keys')
    expect(fs.readdirSync(root)).toEqual([])
  })

  it('exits 1 and leaves a foreign --out folder intact', async () => {
    const { fetch } = fakeDatadog()
    const out = path.join(root, 'desktop')
    fs.mkdirSync(out)
    fs.writeFileSync(path.join(out, 'report.pdf'), 'keep me')

    expect(await runFetchCli(['--out', out], ENV, fetch, NOW)).toBe(1)
    expect(printed.join('\n')).toContain(`${out} holds files other than a Datadog snapshot; nothing written`)
    expect(fs.readdirSync(out)).toEqual(['report.pdf'])
    expect(fs.readdirSync(root)).toEqual(['desktop'])
  })

  it('never writes a key', async () => {
    const { fetch } = fakeDatadog()
    const out = path.join(root, 'snap')

    expect(await runFetchCli(['--out', out], ENV, fetch, NOW)).toBe(0)
    const written = fs.readdirSync(out).map((file) => fs.readFileSync(path.join(out, file), 'utf8')).join('\n')
    expect(written).not.toContain(API_KEY)
    expect(written).not.toContain(APP_KEY)
    expect(fs.readdirSync(root)).toEqual(['snap'])
  })

  it('prints the calls, the counts and the path, never a key', async () => {
    const { fetch } = fakeDatadog()
    const out = path.join(root, 'snap')

    await runFetchCli(['--out', out], ENV, fetch, NOW)
    const output = printed.join('\n')
    expect(output).toContain('GET /api/v1/validate')
    expect(output).toContain('POST /api/v2/events/search')
    expect(output).toContain('monitors 3')
    expect(output).toContain('metrics 10 of 11')
    expect(output).toContain('metric dlq unavailable: fictitious refusal')
    expect(output).toContain(out)
    expect(output).not.toContain(API_KEY)
    expect(output).not.toContain(APP_KEY)
  })

  it.each(['DATADOG_API_KEY', 'DATADOG_APP_KEY'])('exits 1 naming %s when it is missing', async (name) => {
    const { fetch, calls } = fakeDatadog()
    const env = { ...ENV, [name]: '' }

    expect(await runFetchCli([], env, fetch, NOW)).toBe(1)
    expect(printed.join('\n')).toContain(name)
    expect(calls).toEqual([])
  })

  it('reads the site from DD_SITE', async () => {
    const { fetch, calls } = fakeDatadog()

    await runFetchCli(['--out', path.join(root, 'snap')], { ...ENV, DD_SITE: 'datadoghq.com' }, fetch, NOW)
    expect(new Set(calls.map((c) => c.host))).toEqual(new Set(['api.datadoghq.com']))
  })

  it('exits 1 with the cause of any other failure', async () => {
    const fetch: typeof globalThis.fetch = () => Promise.reject(new TypeError('fetch failed'))

    expect(await runFetchCli(['--out', path.join(root, 'snap')], ENV, fetch, NOW)).toBe(1)
    expect(printed.join('\n')).toContain('fetch failed')
    expect(fs.readdirSync(root)).toEqual([])
  })

  it('writes under the package snapshot folder by default, named by the date', async () => {
    const { fetch } = fakeDatadog()
    const day = new Date('2001-02-03T04:05:06Z')
    const snapshots = path.resolve(import.meta.dirname, '../../.datadog-snapshots')
    const dir = path.join(snapshots, '2001-02-03')
    const existed = fs.existsSync(snapshots)
    try {
      expect(await runFetchCli([], ENV, fetch, day)).toBe(0)
      expect(fs.existsSync(path.join(dir, 'meta.json'))).toBe(true)
    } finally {
      fs.rmSync(existed ? dir : snapshots, { recursive: true, force: true })
    }
  })

  it('lists the read scopes under --help', async () => {
    const { fetch, calls } = fakeDatadog()

    expect(await runFetchCli(['--help'], {}, fetch, NOW)).toBe(0)
    for (const scope of ['monitors_read', 'slos_read', 'teams_read', 'incident_read', 'timeseries_query', 'events_read']) {
      expect(printed.join('\n')).toContain(scope)
    }
    expect(calls).toEqual([])
  })
})
