import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { DatadogOverlaySchema } from '@dependency-explorer/schema'
import type { DatadogJoin } from '../extractors/datadog'
import type { GitRunner } from '../pinned'
import { metrics, monitor, release, type KeyedMetrics } from './health/__fixtures__/fake-metrics'
import { DAY, HOUR, WEEK } from './health/series'
import { buildOverlay, healthOf, overlayOf } from './overlay'
import type { DatadogSnapshot } from './snapshot'

const TO = 1773302400
const FROM = TO - 21 * DAY
const MIDNIGHT = TO - (TO % DAY)
const NOW = new Date(TO * 1000)

type Points = [number, number][]
const hourly = (value: (t: number) => number): Points => Array.from({ length: 21 * 24 }, (_, k) => FROM + k * HOUR).map((t): [number, number] => [t, value(t)])
const inLast72h = (t: number) => t >= TO - 72 * HOUR
const inWeekBefore = (t: number) => t >= TO - WEEK - 72 * HOUR && t < TO - WEEK - 52 * HOUR

const KEYED: KeyedMetrics = {
  api_count: { svcplanning: hourly(() => 100), svcsearch: hourly(() => 100) },
  api_5xx: {
    svcplanning: hourly((t) => (inWeekBefore(t) ? 1 : inLast72h(t) ? (t < TO - 62 * HOUR ? 2 : 1) : 0)),
    svcsearch: hourly(() => 0),
    svcbilling: hourly((t) => (t === MIDNIGHT - 3 * DAY + HOUR ? 30 : 0)),
  },
  api_p95: { svcplanning: hourly(() => 200) },
  dlq: {
    'svcreports-exportDlq-prod': hourly((t) => (t === TO - HOUR ? 4 : t === TO - 10 * DAY ? 9 : t === FROM ? 12 : 3)),
  },
}

const noisyTriggers = (id: number, count: number) => Array.from({ length: count }, (_, k) => ({ monitor_id: id, ts: TO - DAY - k * 60, status: 'error' }))

const snapshot: DatadogSnapshot = {
  meta: { fetchedAt: NOW.toISOString(), site: 'datadoghq.eu', from: FROM, to: TO },
  monitors: [
    monitor(701, 'svcghost', 'Errors', 'Alert'),
    monitor(702, 'svcghost', 'Latency'),
    { ...monitor(703, 'svcghost', 'Staging'), tags: ['env:staging', 'service:svcghost'] },
    { ...monitor(704, 'svcghost', 'Untagged'), name: 'Untagged', tags: ['env:prod'] },
    { ...monitor(705, 'svcghost', 'Pending'), overall_state: null },
  ],
  teams: [],
  slos: [
    { id: 'slo-1', name: 'svc-search availability', tags: ['service:svcsearch', 'env:prod'], target: 99.9, value: 99.95 },
    { id: 'slo-2', name: 'svc-search latency', tags: ['service:svcsearch', 'env:prod'], target: 99, value: null },
    { id: 'slo-3', name: 'svc-search draft', tags: ['service:svcsearch', 'env:prod'], target: null, value: null },
  ],
  incidents: [
    { id: 'inc-1', public_id: 42, title: 'Search is down', severity: 'SEV-2', created: null, services: ['svc-search'] },
    { id: 'inc-2', public_id: null, title: 'Search is slow', severity: null, created: null, services: ['svcSearch'] },
    { id: 'inc-3', public_id: 43, title: 'Billing is late', severity: 'SEV-3', created: null, services: ['svc-billing'] },
  ],
  metrics: metrics(KEYED),
  events: { items: [...noisyTriggers(701, 50), ...noisyTriggers(702, 49)], capped: false },
}

const join: DatadogJoin = {
  serviceOfDatadog: new Map([
    ['svcplanning', 'svc-planning'],
    ['svcreports', 'svc-reports'],
    ['svcbilling', 'svc-billing'],
    ['svcSearch', 'svc-search'],
    ['svcsearch', 'svc-search'],
    ['svcghost', 'svc-ghost'],
  ]),
  queueOfDatadog: new Map([['svcreports-exportDlq-prod', 'sqs:exportDlq']]),
  findings: [],
}

const REPOS = fs.mkdtempSync(path.join(os.tmpdir(), 'overlay-repos-'))
for (const repo of ['svc-planning', 'svc-reports', 'svc-billing', 'svc-search', 'svc-ghost', 'svc-alpha', 'svc-beta', 'svc-gamma']) {
  fs.mkdirSync(path.join(REPOS, repo))
}
afterAll(() => {
  fs.rmSync(REPOS, { recursive: true, force: true })
})

const engine = healthOf(snapshot, join, [release('svc-planning', 456, '2.4.0', TO - DAY), release('svc-planning', 400, '2.3.0', TO - 5 * DAY)])

const overlay = () => buildOverlay(snapshot, join, engine, NOW)

describe('buildOverlay', () => {
  it('ranks each service by the first state that holds: problem, dig, fell back, healthy, no data', () => {
    const states = Object.fromEntries(Object.entries(overlay().services).map(([name, s]) => [name, s.state]))
    expect(states).toEqual({ 'svc-planning': 'problem', 'svc-reports': 'dig', 'svc-billing': 'fellBack', 'svc-search': 'healthy', 'svc-ghost': 'noData' })
  })

  it('renders each reason with its rule and figures', () => {
    const { services } = overlay()
    expect(services['svc-planning']?.reasons).toEqual(['5xx 4.1× (+62) over 72 h'])
    expect(services['svc-reports']?.reasons).toEqual(['DLQ svcreports-exportDlq-prod above 0 for 72 h, 4 now'])
    expect(services['svc-billing']?.reasons).toEqual([`Fell back on ${new Date((MIDNIGHT - 3 * DAY) * 1000).toISOString().slice(0, 10)}: 5xx 30`])
    expect(services['svc-search']?.reasons).toEqual([])
  })

  it('draws a 14-day strip of requests, 5xx and p95', () => {
    const { strip } = overlay().services['svc-search'] ?? { strip: [] }
    expect(strip).toHaveLength(14)
    expect(strip.at(-2)).toEqual({ day: new Date((MIDNIGHT - DAY) * 1000).toISOString().slice(0, 10), requests: 2400, errors5xx: 0, p95ms: null })
    expect(overlay().services['svc-planning']?.strip.at(-1)?.p95ms).toBe(200)
    expect(overlay().services['svc-ghost']?.strip.at(-1)).toMatchObject({ requests: null, errors5xx: null, p95ms: null })
  })

  it('reads the DLQ depth now and its 14-day max, keyed by the registry resource', () => {
    expect(overlay().queues).toEqual({ 'sqs:exportDlq': { depthNow: 4, depthMax14d: 9 } })
  })

  it('lists prod monitors, noisy at 50 transitions in 7 days and not at 49', () => {
    expect(overlay().services['svc-ghost']?.monitors).toEqual([
      { id: 701, name: '[P2][svcghost][prod] Errors', status: 'Alert', noisy: true, url: 'https://app.datadoghq.eu/monitors/701' },
      { id: 702, name: '[P2][svcghost][prod] Latency', status: 'OK', noisy: false, url: 'https://app.datadoghq.eu/monitors/702' },
      { id: 705, name: '[P2][svcghost][prod] Pending', status: 'unknown', noisy: false, url: 'https://app.datadoghq.eu/monitors/705' },
    ])
  })

  it('keeps SLOs with a target and the incidents naming the service, linked by public id or else id', () => {
    const search = overlay().services['svc-search']
    expect(search?.slos).toEqual([
      { id: 'slo-1', name: 'svc-search availability', target: 99.9, value: 99.95, url: 'https://app.datadoghq.eu/slo?slo_id=slo-1' },
      { id: 'slo-2', name: 'svc-search latency', target: 99, value: null, url: 'https://app.datadoghq.eu/slo?slo_id=slo-2' },
    ])
    expect(search?.incidents).toEqual([
      { id: 'inc-1', title: 'Search is down', severity: 'SEV-2', url: 'https://app.datadoghq.eu/incidents/42' },
      { id: 'inc-2', title: 'Search is slow', severity: 'unknown', url: 'https://app.datadoghq.eu/incidents/inc-2' },
    ])
  })

  it('lists the releases of the last 14 days with their verdict, titled by their PR or else their version', () => {
    const titled = buildOverlay(snapshot, join, engine, NOW, new Map([['sha456', 'feat(planning): faster export']]))
    expect(titled.services['svc-planning']?.releases).toEqual([
      { sha: 'sha400', title: 'v2.3.0', mergedAt: new Date((TO - 5 * DAY) * 1000).toISOString(), verdict: 'steady' },
      { sha: 'sha456', title: 'feat(planning): faster export', mergedAt: new Date((TO - DAY) * 1000).toISOString(), verdict: 'tooRecent' },
    ])
  })

  it('dates the snapshot and carries the events cap', () => {
    expect(overlay()).toMatchObject({ snapshotDate: NOW.toISOString().slice(0, 10), eventsCapped: false })
  })

  it('passes the overlay schema and holds no key, message or query', () => {
    const built = overlay()
    expect(DatadogOverlaySchema.parse(built)).toEqual(built)
    const text = JSON.stringify(built)
    for (const secret of ['DATADOG_API_KEY', 'DATADOG_APP_KEY', 'message', 'query', 'aws.apigateway', 'tag_set']) {
      expect(text).not.toContain(secret)
    }
  })
})

const daily = (value: (d: number) => number): Points => Array.from({ length: 21 }, (_, k) => MIDNIGHT - (20 - k) * DAY).map((d): [number, number] => [d, value(d)])
const BAD_DAY = MIDNIGHT - 4 * DAY

describe('buildOverlay reasons', () => {
  const others: DatadogSnapshot = {
    ...snapshot,
    monitors: [],
    slos: [],
    incidents: [],
    events: { items: [], capped: true },
    metrics: {
      ...metrics({
        lambda_errors: { svcalpha: hourly((t) => (inLast72h(t) ? 2 : 0)) },
        api_p95: { svcalpha: hourly((t) => (inLast72h(t) ? 400 : 200)), svcgamma: hourly((t) => (t >= BAD_DAY && t < BAD_DAY + DAY ? 1000 : 200)) },
        fn_invocations: { 'svcbeta|export': daily(() => 20), 'svcbeta|sync': daily(() => 1000), 'svcgamma|job': daily(() => 10000) },
        fn_errors: { 'svcbeta|export': daily(() => 15), 'svcbeta|sync': daily(() => 150), 'svcgamma|job': daily((d) => (d === BAD_DAY ? 500 : 0)) },
        apm_status: { 'svcbeta|get_/plans|5xx': daily(() => 10), 'svcbeta|get_/plans|2xx': daily(() => 90) },
      }),
      dlq: [
        { tag_set: ['queuename:orphanDlq'], pointlist: [[TO * 1000, 1]] },
        { tag_set: [], pointlist: [[TO * 1000, 1]] },
        { tag_set: ['queuename:svcreports-exportDlq-prod'], pointlist: [[TO * 1000, null]] },
      ],
    },
  }
  const othersJoin: DatadogJoin = {
    serviceOfDatadog: new Map([['svcalpha', 'svc-alpha'], ['svcbeta', 'svc-beta'], ['svcgamma', 'svc-gamma']]),
    queueOfDatadog: join.queueOfDatadog,
    findings: [],
  }
  const built = () => overlayOf(others, othersJoin, REPOS, false, () => '')

  it('renders Lambda error and p95 rises, failing functions, failing routes and bad-day causes', () => {
    const reasons = Object.fromEntries(Object.entries(built().services).map(([name, s]) => [name, s.reasons]))
    expect(reasons).toEqual({
      'svc-alpha': ['Lambda errors 144× (+144) over 72 h', 'p95 200 → 400 ms over 72 h'],
      'svc-beta': ['GET /plans 5xx 10 % of calls, 10 % the week before', 'export fails 75 % of 140 runs', 'sync fails 15 % of runs, 150 a day'],
      'svc-gamma': [`Fell back on ${new Date(BAD_DAY * 1000).toISOString().slice(0, 10)}: p95 1000 ms, job errors 500`],
    })
  })

  it('skips DLQ series with no registry resource or no points, and carries the events cap', () => {
    expect(built()).toMatchObject({ queues: {}, eventsCapped: true })
  })

  it('keeps the highest depths when two Datadog queue names fold into one resource', () => {
    const series = (name: string, pointlist: [number, number][]) => ({ tag_set: [`queuename:${name}`], pointlist })
    const twoNames: DatadogSnapshot = {
      ...others,
      metrics: { ...others.metrics, dlq: [series('svcreports-exportDlq-prod', [[(TO - DAY) * 1000, 9], [TO * 1000, 2]]), series('svcReports-exportDlq-prod', [[TO * 1000, 5]])] },
    }
    const queueJoin: DatadogJoin = { ...othersJoin, queueOfDatadog: new Map([['svcreports-exportDlq-prod', 'sqs:exportDlq'], ['svcReports-exportDlq-prod', 'sqs:exportDlq']]) }
    expect(buildOverlay(twoNames, queueJoin, engine, NOW).queues).toEqual({ 'sqs:exportDlq': { depthNow: 5, depthMax14d: 9 } })
  })

  it('reads no queue when the DLQ query failed', () => {
    expect(buildOverlay({ ...others, metrics: metrics() }, othersJoin, engine, NOW).queues).toEqual({})
  })
})

describe('overlayOf', () => {
  let error: MockInstance<typeof console.error>
  beforeEach(() => {
    error = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const mergeAt = (t: number, n: number) => `sha${n}\t${new Date(t * 1000).toISOString()}\tMerge pull request #${n} from skelloapp/staging\tfeat: change ${n}\n`
  const git: GitRunner = (cwd) => {
    if (cwd.endsWith('svc-planning')) {
      return mergeAt(TO - 2 * DAY, 900)
    }
    throw new Error('fatal: ambiguous argument master\nUse -- to separate paths')
  }

  it('prints one line per repo whose releases cannot be read', () => {
    overlayOf(snapshot, join, REPOS, false, git)
    expect(error).toHaveBeenCalledWith('  releases of svc-search skipped: fatal: ambiguous argument master')
    expect(error).toHaveBeenCalledTimes(4)
  })

  it('skips a repo with no checkout without calling git', () => {
    const seen: string[] = []
    overlayOf(snapshot, join, path.join(REPOS, 'missing'), false, (cwd) => {
      seen.push(cwd)
      return ''
    })
    expect(error).toHaveBeenCalledWith('  releases of svc-planning skipped: no checkout')
    expect(seen).toEqual([])
  })

  it('reads HEAD of the pinned worktree, the production branch otherwise', () => {
    const refs = (pinned: boolean) => {
      const seen: string[] = []
      overlayOf(snapshot, join, REPOS, pinned, (cwd, args) => {
        seen.push(`${cwd} ${args.at(-1)}`)
        return ''
      })
      return seen
    }
    expect(refs(true)).toContain(`${path.join(REPOS, 'svc-planning')} HEAD`)
    expect(refs(false)).toContain(`${path.join(REPOS, 'svc-planning')} master`)
  })

  it('judges a release once when Datadog spells its service two ways', () => {
    const MERGED = TO - 5 * DAY
    const spelled: DatadogSnapshot = {
      ...snapshot,
      monitors: [{ ...monitor(801, 'svc-search', 'Errors'), name: 'Errors' }],
      slos: [],
      incidents: [],
      events: { items: [], capped: false },
      metrics: metrics({ api_count: { svcsearch: hourly(() => 100) }, api_5xx: { svcsearch: hourly((t) => (t >= MERGED ? 1 : 0)) } }),
    }
    const twoSpellings: DatadogJoin = { serviceOfDatadog: new Map([['svcsearch', 'svc-search'], ['svc-search', 'svc-search']]), queueOfDatadog: new Map(), findings: [] }
    const search = overlayOf(spelled, twoSpellings, REPOS, false, () => mergeAt(MERGED, 77)).services['svc-search']
    expect(search?.releases).toEqual([{ sha: 'sha77', title: 'feat: change 77', mergedAt: new Date(MERGED * 1000).toISOString(), verdict: 'regressed' }])
    expect(search?.reasons).toEqual(['5xx 72× (+72) over 72 h'])
    expect(search?.monitors.map((m) => m.id)).toEqual([801])
  })

  it('merges the series two spellings carry for one metric, summing counts and keeping the highest p95', () => {
    const DAY_BEFORE = MIDNIGHT - DAY
    const keyed = metrics({
      api_count: { svcsearch: hourly(() => 100), 'svc-search': hourly(() => 50) },
      api_p95: { svcsearch: hourly(() => 200), 'svc-search': hourly(() => 300) },
    })
    const gap = { tag_set: ['name:svcSearch-prod'], pointlist: [[DAY_BEFORE * 1000, null], [(DAY_BEFORE + HOUR) * 1000, null]] satisfies [number, null][] }
    const spelled: DatadogSnapshot = { ...snapshot, metrics: { ...keyed, api_count: [...(keyed.api_count ?? []), gap] } }
    const twoSpellings: DatadogJoin = {
      serviceOfDatadog: new Map([['svcsearch', 'svc-search'], ['svc-search', 'svc-search'], ['svcSearch', 'svc-search']]),
      queueOfDatadog: new Map(),
      findings: [],
    }
    const strip = overlayOf(spelled, twoSpellings, REPOS, false, () => '').services['svc-search']?.strip
    expect(strip?.at(-2)).toEqual({ day: new Date(DAY_BEFORE * 1000).toISOString().slice(0, 10), requests: 3600, errors5xx: null, p95ms: 300 })
  })

  it('judges each repo from its production branch, a missing branch leaving it without releases', () => {
    const built = overlayOf(snapshot, join, REPOS, false, git)
    expect(built.services['svc-planning']?.releases).toEqual([
      { sha: 'sha900', title: 'feat: change 900', mergedAt: new Date((TO - 2 * DAY) * 1000).toISOString(), verdict: 'tooRecent' },
    ])
    expect(built.services['svc-search']?.releases).toEqual([])
    expect(built.services['svc-planning']?.state).toBe('problem')
  })

  it('judges case variants of a service name once', () => {
    const folded: DatadogJoin = { ...join, serviceOfDatadog: new Map([...join.serviceOfDatadog, ['SvcPlanning', 'svc-planning']]) }
    expect(overlayOf(snapshot, folded, REPOS, false, git).services['svc-planning']?.reasons).toEqual(['5xx 4.1× (+62) over 72 h'])
  })
})
