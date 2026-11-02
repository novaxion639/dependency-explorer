import { describe, expect, test } from 'vitest'
import { DAY, H, MIDNIGHT, NOW, daily, dayOf, engineInput, hourly, metrics, monitor, release, type KeyedMetrics } from './fake-metrics'
import { topicsOf } from './topics'

const PLANNING = { name: 'svcplanning', repo: 'svc-planning' }
const REPORTS = { name: 'svcreports', repo: 'svc-reports' }
const steady = (v: number) => hourly(() => v)

const MERGED = MIDNIGHT - DAY + 10.5 * H
const regressionOf = (merged = MERGED, until = NOW): KeyedMetrics => ({
  api_count: { svcplanning: steady(100) },
  api_5xx: { svcplanning: hourly((t) => (t >= merged + 1.5 * H && t < until ? 2 : 0)) },
  api_p95: { svcplanning: hourly((t) => (t >= merged + 2.5 * H && t < until ? 700 : 200)) },
})
const regression = (merged = MERGED, until = NOW) => metrics(regressionOf(merged, until))

describe('a problem now', () => {
  const input = () =>
    engineInput({
      metrics: regression(),
      monitors: [
        monitor(501, 'svcplanning', 'Erreurs 5xx', 'Alert'),
        monitor(502, 'svcplanning', 'Latence', 'OK'),
        monitor(503, 'svcreports', 'Export', 'Alert'),
      ],
      triggers: [
        { monitor_id: 501, ts: MERGED + 110 * 60, status: 'error' },
        { monitor_id: 502, ts: MERGED - 2 * H, status: 'warn' },
        { monitor_id: 502, ts: MERGED + 3 * H, status: 'warn' },
        { monitor_id: 503, ts: MERGED + 3 * H, status: 'error' },
      ],
      releases: [release('svc-planning', 456, '2.4.0', MERGED, ['planning: faster export'])],
    })

  test('a regression 1.5 h after a release is a problem caused by it, the story opening on the release', () => {
    const { topics, services, releases } = topicsOf(input())
    expect(topics).toEqual([
      {
        id: 'pb:svcplanning',
        kind: 'pb',
        type: 'problem',
        svc: 'svcplanning',
        since: MERGED,
        why: ['5xx'],
        cause: { n: 456, v: 'v2.4.0', repo: 'svc-planning', ts: MERGED, delay_min: 90 },
        cmp: { e5: [0, 40], p95: [200, 200], lerr: [0, 0], count: [16800, 16800] },
        last_error: MIDNIGHT + 8 * H,
        linked: [{ id: 501, name: 'Erreurs 5xx' }],
        story: [
          { ts: MERGED, type: 'release', label: 'v2.4.0' },
          { ts: MERGED + 1.5 * H, type: 'first_error' },
          { ts: MERGED + 110 * 60, type: 'monitor', label: 'Erreurs 5xx' },
          { ts: MERGED + 2.5 * H, type: 'slow', value: 700 },
          { ts: MIDNIGHT + 8 * H, type: 'last_error' },
        ],
        value: 40,
      },
    ])
    expect(services[0]?.status).toBe('pb')
    expect(services[0]?.days.at(-1)).toEqual({
      d: MIDNIGHT,
      bad: true,
      why: [
        { kind: '5xx', value: 18 },
        { kind: 'p95', value: 700 },
      ],
    })
    expect(releases).toEqual([
      {
        svc: 'svcplanning',
        repo: 'svc-planning',
        n: 456,
        v: 'v2.4.0',
        ts: MERGED,
        sha: 'sha456',
        changes: ['planning: faster export'],
        verdict: 'tooRecent',
        why: ['5xx', 'p95'],
      },
    ])
  })

  test('the latest of two regressing releases is the cause', () => {
    const earlier = MIDNIGHT - 2 * DAY + 10 * H
    const releases = [release('svc-planning', 455, '2.3.9', earlier), release('svc-planning', 456, '2.4.0', MERGED)]
    const out = topicsOf(engineInput({ metrics: regression(), releases }))
    expect(out.releases.map((r) => [r.n, r.verdict, r.why.length > 0])).toEqual([
      [455, 'tooRecent', true],
      [456, 'tooRecent', true],
    ])
    expect(out.topics[0]).toMatchObject({ since: MERGED, cause: { n: 456 } })
  })

  test('a 5xx in the hour of the merge reads a delay of 0', () => {
    const releases = [release('svc-planning', 456, '2.4.0', MERGED)]
    const { topics } = topicsOf(engineInput({ metrics: regression(MERGED - 2 * H), releases }))
    expect(topics[0]).toMatchObject({ cause: { n: 456, delay_min: 0 } })
  })

  test('the same service quiet for the last 24 h has no problem, its bad day has fallen back', () => {
    const merged = MERGED - DAY
    const releases = [release('svc-planning', 456, '2.4.0', merged)]
    const { topics, services } = topicsOf(engineInput({ metrics: regression(merged, MIDNIGHT - DAY), releases }))
    const day = MIDNIGHT - 2 * DAY
    expect(topics).toEqual([
      {
        id: `rs:svcplanning:${day}`,
        kind: 'rs',
        type: 'day',
        svc: 'svcplanning',
        day,
        why: [{ kind: '5xx', value: 24 }],
        hours: [merged + 1.5 * H, MIDNIGHT - DAY],
        release: { n: 456, v: 'v2.4.0' },
        value: 0,
      },
    ])
    expect(services[0]?.status).toBe('ok')
    expect(services[0]?.days.at(-1)?.bad).toBe(false)
  })
})

describe('the 24 h bar of a problem', () => {
  const twoDaysAgo = MIDNIGHT - 2 * DAY + 8 * H
  const lastHours = MIDNIGHT + 6 * H
  const opens = (key: 'api_5xx' | 'lambda_errors', before: number, recent: number) => {
    const series = hourly((t) => (t === twoDaysAgo ? before : t === lastHours ? recent : 0))
    const { topics } = topicsOf(engineInput({ metrics: metrics({ [key]: { svcplanning: series } }) }))
    return topics.some((t) => t.kind === 'pb')
  }

  test('8 5xx over the last 24 h open a problem, 4 do not', () => {
    expect(opens('api_5xx', 30, 8)).toBe(true)
    expect(opens('api_5xx', 30, 4)).toBe(false)
  })

  test('40 Lambda errors over the last 24 h open a problem, 20 do not', () => {
    expect(opens('lambda_errors', 200, 40)).toBe(true)
    expect(opens('lambda_errors', 200, 20)).toBe(false)
  })
})

describe('the start of a problem', () => {
  const HOUR_72 = NOW - 72 * H - ((NOW - 72 * H) % H)

  test('an older spike of the week moves neither the start nor the cause, and falls back on its own', () => {
    const spike = MIDNIGHT - 5 * DAY
    const inSpike = (t: number) => t >= spike + 10 * H && t < spike + 16 * H
    const m = metrics({
      ...regressionOf(),
      api_5xx: { svcplanning: hourly((t) => (t >= MERGED + 1.5 * H || inSpike(t) ? 2 : 0)) },
    })
    const releases = [release('svc-planning', 456, '2.4.0', MERGED)]
    const { topics } = topicsOf(engineInput({ metrics: m, releases }))
    expect(topics.map((t) => t.id)).toEqual(['pb:svcplanning', `rs:svcplanning:${spike}`])
    expect(topics[0]).toMatchObject({ since: MERGED, cause: { n: 456, v: 'v2.4.0' } })
  })

  test('without a release, a problem starts on the first of the bad days running into today', () => {
    const m = metrics({ api_p95: { svcplanning: hourly((t) => (t >= HOUR_72 ? 500 : 200)) } })
    const { topics } = topicsOf(engineInput({ metrics: m }))
    expect(topics).toEqual([expect.objectContaining({ type: 'problem', since: MIDNIGHT - 3 * DAY, why: ['p95'] })])
    expect(topics[0]).toMatchObject({ cmp: { p95: [200, 500] }, cause: null })
  })

  test('a problem with no bad day starts on the first hour of the 72 h its errors are above zero', () => {
    const m = metrics({ lambda_errors: { svcplanning: hourly((t) => (t >= HOUR_72 ? 5 : 0)) } })
    const { topics } = topicsOf(engineInput({ metrics: m }))
    expect(topics).toEqual([expect.objectContaining({ type: 'problem', since: HOUR_72, why: ['lerr'] })])
  })

  test('without a cause nor a bad day the start holds from one collection to the next an hour later', () => {
    const from = MIDNIGHT - 3 * DAY + 12 * H
    const since = (over: KeyedMetrics) =>
      [NOW, NOW + H].map((now) => {
        const pb = topicsOf(engineInput({ now, metrics: metrics(over) })).topics[0]
        return pb?.kind === 'pb' ? pb.since : null
      })
    expect(since({ lambda_errors: { svcplanning: hourly((t) => (t >= from ? 5 : 0)) } })).toEqual([from, from])
    const every3h = (t: number) => (t >= from && (t - from) % (3 * H) === 0 ? 1 : 0)
    expect(
      since({
        api_count: { svcplanning: steady(100) },
        api_5xx: { svcplanning: hourly(every3h) },
        lambda_errors: { svcplanning: steady(1) },
      }),
    ).toEqual([from, from])
    const hourOf = (t: number) => (t % DAY) / H
    const slow = (t: number) => t >= from && (t >= MIDNIGHT ? hourOf(t) < 4 : hourOf(t) >= 12 && hourOf(t) <= 22)
    expect(since({ api_p95: { svcplanning: hourly((t) => (slow(t) ? 500 : 200)) } })).toEqual([from, from])
  })

  test('a problem of a service without API Gateway dates its errors by the Lambda errors', () => {
    const m = metrics({ lambda_errors: { svcplanning: hourly((t) => (t >= MERGED + 1.5 * H ? 10 : 0)) } })
    const { topics } = topicsOf(engineInput({ metrics: m }))
    expect(topics[0]).toMatchObject({
      why: ['lerr'],
      since: MERGED + 1.5 * H,
      last_error: MIDNIGHT + 8 * H,
      story: [
        { ts: MERGED + 1.5 * H, type: 'first_error' },
        { ts: MIDNIGHT + 8 * H, type: 'last_error' },
      ],
    })
  })
})

describe('to dig', () => {
  test('a route at 7 % 5xx both weeks is a route topic with its share', () => {
    const m = metrics({
      apm_hits: { 'svcreports|post_/reports/export': daily(() => 100) },
      apm_p95: { 'svcreports|post_/reports/export': daily(() => 0.25) },
      apm_status: {
        'svcreports|post_/reports/export|2xx': daily(() => 93),
        'svcreports|post_/reports/export|5xx': daily(() => 7),
      },
    })
    const { topics, services } = topicsOf(engineInput({ services: [REPORTS], metrics: m }))
    expect(topics).toEqual([
      {
        id: 'route:svcreports:POST /reports/export',
        kind: 'dg',
        type: 'route',
        svc: 'svcreports',
        route: 'POST /reports/export',
        share: 7,
        share_prev: 7,
        p95: 250,
        value: 7,
      },
    ])
    expect(services[0]?.status).toBe('dg')
  })

  test('a route under 50 traced calls in either week or at 2 % is not a topic', () => {
    const m = metrics({
      apm_status: {
        'svcreports|get_/a|2xx': daily(() => 5),
        'svcreports|get_/a|5xx': daily(() => 1),
        'svcreports|get_/b|2xx': daily(() => 98),
        'svcreports|get_/b|5xx': daily(() => 2),
        'svcreports|get_/c|2xx': daily((d) => (d >= -6 ? 93 : 5)),
        'svcreports|get_/c|5xx': daily((d) => (d >= -6 ? 7 : 1)),
      },
    })
    expect(topicsOf(engineInput({ services: [REPORTS], metrics: m })).topics).toEqual([])
  })

  test('a Swagger function failing 78 of 79 calls is broken', () => {
    const m = metrics({
      fn_invocations: { 'svcreports|swagger': daily((d) => (d === -2 ? 79 : 0)) },
      fn_errors: { 'svcreports|swagger': daily((d) => (d === -2 ? 78 : 0)) },
    })
    const { topics } = topicsOf(engineInput({ services: [REPORTS], metrics: m }))
    expect(topics).toEqual([
      {
        id: 'fn:svcreports:swagger',
        kind: 'dg',
        type: 'fn_broken',
        svc: 'svcreports',
        fn: 'swagger',
        err: 78,
        inv: 79,
        err_prev: 0,
        swagger: true,
        value: 98.7,
      },
    ])
  })

  test('a job at 35 % errors with a spike day stays chronic, its spike day falls back with the latest release before', () => {
    const merged = MIDNIGHT - 5 * DAY + 15 * H
    const m = metrics({
      fn_invocations: { 'svcreports|exportjob': daily((d) => (d === -4 ? 20000 : 1000)) },
      fn_errors: { 'svcreports|exportjob': daily((d) => (d === -4 ? 3000 : 350)) },
    })
    const input = engineInput({
      services: [REPORTS],
      metrics: m,
      releases: [
        release('svc-reports', 87, '1.2.9', MIDNIGHT - 6 * DAY + H),
        release('svc-reports', 88, '1.3.0', merged),
      ],
    })
    const { topics, services } = topicsOf(input)
    expect(topics).toEqual([
      {
        id: 'fn:svcreports:exportjob',
        kind: 'dg',
        type: 'fn_chronic',
        svc: 'svcreports',
        fn: 'exportjob',
        rate: 19.6,
        per_day: 350,
        value: 19.6,
      },
      {
        id: `rs:svcreports:${MIDNIGHT - 4 * DAY}`,
        kind: 'rs',
        type: 'day',
        svc: 'svcreports',
        day: MIDNIGHT - 4 * DAY,
        why: [{ kind: 'fn', fn: 'exportjob', value: 3000 }],
        hours: null,
        release: { n: 88, v: 'v1.3.0' },
        value: 0,
      },
    ])
    expect(services[0]?.status).toBe('dg')
  })

  test('a queue filled from day -18 to -7 then falling by one a day expires 14 days after its last arrival', () => {
    const stock = (t: number) => {
      const d = dayOf(t)
      return d < -18 ? 0 : d <= -7 ? 5 * (d + 19) : 60 - (d + 7)
    }
    const m = metrics({ dlq: { 'svcreports-exportdlq-prod': hourly(stock) } })
    const { topics } = topicsOf(engineInput({ services: [REPORTS], metrics: m }))
    expect(topics).toEqual([
      {
        id: 'dlq:svcreports-exportdlq-prod',
        kind: 'dg',
        type: 'dlq',
        svc: 'svcreports',
        queue: 'svcreports-exportdlq-prod',
        count: 53,
        expiring: { last_in: MIDNIGHT - 7 * DAY, expires: MIDNIGHT + 7 * DAY },
        value: 53,
      },
    ])
  })

  test('a queue back at 0 within the last 72 h is not a topic, even holding messages now', () => {
    const empty = NOW - 30 * H - ((NOW - 30 * H) % H)
    const m = metrics({ dlq: { 'svcreports-exportdlq-prod': hourly((t) => (t === empty ? 0 : 3)) } })
    expect(topicsOf(engineInput({ services: [REPORTS], metrics: m })).topics).toEqual([])
  })

  test('a queue that received two days ago does not expire yet, an empty one is no topic', () => {
    const m = metrics({
      dlq: {
        'svcreports-exportdlq-prod': hourly((t) => (dayOf(t) >= -1 ? 4 : dayOf(t) >= -2 ? 6 : 2)),
        'svcreports-importdlq-prod': hourly(() => 0),
      },
    })
    const { topics } = topicsOf(engineInput({ services: [REPORTS], metrics: m }))
    expect(topics).toEqual([expect.objectContaining({ queue: 'svcreports-exportdlq-prod', count: 4, expiring: null })])
  })

  test("a route's share and a function's rate keep a tenth of a percent", () => {
    const m = metrics({
      apm_status: { 'svcreports|get_/r|2xx': daily(() => 20), 'svcreports|get_/r|5xx': daily(() => 1) },
      fn_invocations: { 'svcreports|job': daily(() => 30) },
      fn_errors: { 'svcreports|job': daily(() => 19) },
    })
    const { topics } = topicsOf(engineInput({ services: [REPORTS], metrics: m }))
    expect(topics.map((t) => [t.type, t.value])).toEqual([
      ['route', 4.8],
      ['fn_broken', 63.3],
    ])
    expect(topics[0]).toMatchObject({ share: 4.8, share_prev: 4.8 })
  })

  test('a queue goes to the service with the longest name before it, once', () => {
    const export_ = { name: 'svcplanning-export', repo: 'svcplanning-export' }
    const m = metrics({
      dlq: { 'svcplanning-export-dlq-prod': hourly(() => 3), 'svcplanning-dlq-prod': hourly(() => 2) },
    })
    const { topics } = topicsOf(engineInput({ services: [PLANNING, export_], metrics: m }))
    expect(topics.map((t) => [t.id, t.svc])).toEqual([
      ['dlq:svcplanning-dlq-prod', 'svcplanning'],
      ['dlq:svcplanning-export-dlq-prod', 'svcplanning-export'],
    ])
  })
})

describe('services', () => {
  test('a service without an API Gateway has its functions and queues judged, measured without api', () => {
    const m = metrics({
      lambda_errors: { svcreports: steady(10) },
      fn_invocations: { 'svcreports|exportjob': daily(() => 1000) },
      fn_errors: { 'svcreports|exportjob': daily(() => 300) },
      dlq: { 'svcreports-exportdlq-prod': hourly(() => 3) },
    })
    const { topics, services } = topicsOf(engineInput({ services: [REPORTS], metrics: m }))
    expect(topics).toEqual([
      {
        id: 'fn:svcreports:exportjob',
        kind: 'dg',
        type: 'fn_chronic',
        svc: 'svcreports',
        fn: 'exportjob',
        rate: 30,
        per_day: 300,
        value: 30,
      },
      {
        id: 'dlq:svcreports-exportdlq-prod',
        kind: 'dg',
        type: 'dlq',
        svc: 'svcreports',
        queue: 'svcreports-exportdlq-prod',
        count: 3,
        expiring: null,
        value: 3,
      },
    ])
    expect(services[0]).toMatchObject({ status: 'dg', measured: ['lambda'] })
    expect(services[0]?.days).toEqual(
      Array.from({ length: 14 }, (_, k) => ({ d: MIDNIGHT - (13 - k) * DAY, bad: false, why: [] })),
    )
  })

  test('a service with no data at all is ok with empty series', () => {
    for (const m of [metrics(), null]) {
      const { services, topics } = topicsOf(engineInput({ services: [PLANNING], metrics: m }))
      expect(topics).toEqual([])
      expect(services[0]).toMatchObject({
        name: 'svcplanning',
        repo: 'svc-planning',
        status: 'ok',
        measured: [],
      })
      expect(services[0]?.days).toHaveLength(14)
      expect(services[0]?.days.some((d) => d.bad)).toBe(false)
    }
  })

  test('a series without a point measures nothing', () => {
    const m = metrics({
      api_count: { svcplanning: [] },
      api_p95: { svcplanning: [[NOW - 30 * DAY, 100]] },
      lambda_errors: { svcplanning: [] },
      fn_invocations: { 'svcplanning|sync': [] },
      apm_hits: { 'svcplanning|get_/a': [] },
    })
    expect(topicsOf(engineInput({ services: [PLANNING], metrics: m })).services[0]?.measured).toEqual([])
  })

  test('a service named with capitals reads the lowercased keys of the metrics', () => {
    const m = metrics({
      fn_invocations: { 'svcreports|exportjob': daily(() => 1000) },
      fn_errors: { 'svcreports|exportjob': daily(() => 300) },
      dlq: { 'svcreports-exportdlq-prod': hourly(() => 3) },
    })
    const { services, topics } = topicsOf(engineInput({ services: [{ ...REPORTS, name: 'SvcReports' }], metrics: m }))
    expect(topics.map((t) => t.id)).toEqual(['fn:SvcReports:exportjob', 'dlq:svcreports-exportdlq-prod'])
    expect(services[0]?.measured).toEqual(['lambda'])
  })

  test('a failed query leaves only its series empty, its figures unknown rather than 0, the rest is judged', () => {
    const m = metrics({
      ...regressionOf(),
      api_5xx: null,
      apm_status: null,
      apm_hits: { 'svcplanning|get_/plannings': daily(() => 100) },
    })
    const { services, topics } = topicsOf(engineInput({ services: [PLANNING], metrics: m }))
    expect(topics).toEqual([])
    expect(services[0]?.days.at(-1)).toEqual({ d: MIDNIGHT, bad: false, why: [] })
    expect(services[0]?.measured).toEqual(['apm'])
  })

  test('a problem whose 5xx were not read compares no 5xx', () => {
    const m = metrics({
      ...regressionOf(),
      api_5xx: null,
      api_p95: { svcplanning: hourly((t) => (t >= NOW - 72 * H ? 700 : 200)) },
    })
    const { topics } = topicsOf(engineInput({ services: [PLANNING], metrics: m }))
    expect(topics[0]).toMatchObject({ type: 'problem', why: ['p95'], cmp: { e5: null, p95: [200, 700] } })
  })

  test('a service measured by API Gateway needs both its calls and its 5xx', () => {
    const counted = metrics({ api_count: { svcplanning: steady(100) }, api_5xx: { svcplanning: [] } })
    const both = metrics({ api_count: { svcplanning: steady(100) }, api_5xx: { svcplanning: steady(0) } })
    const measured = (m: typeof counted) =>
      topicsOf(engineInput({ services: [PLANNING], metrics: m })).services[0]?.measured
    expect(measured(counted)).toEqual([])
    expect(measured(both)).toEqual(['api'])
  })
})

describe('releases', () => {
  test('a release whose 72 h after are flat against the week before is flat', () => {
    const m = metrics({ api_count: { svcplanning: steady(100) }, api_5xx: { svcplanning: steady(1) } })
    const merged = MIDNIGHT - 5 * DAY
    const { releases } = topicsOf(engineInput({ metrics: m, releases: [release('svc-planning', 9, '2.3.0', merged)] }))
    expect(releases).toEqual([expect.objectContaining({ n: 9, verdict: 'steady', why: [] })])
  })

  test('a release older than 72 h whose 72 h after rose against the week before is regressed', () => {
    const merged = MIDNIGHT - 5 * DAY
    const m = metrics({ api_5xx: { svcplanning: hourly((t) => (t >= merged && t < merged + 72 * H ? 2 : 0)) } })
    const { releases } = topicsOf(engineInput({ metrics: m, releases: [release('svc-planning', 11, '2.6.0', merged)] }))
    expect(releases).toEqual([expect.objectContaining({ n: 11, sha: 'sha11', verdict: 'regressed', why: ['5xx'] })])
  })

  test('a release younger than 72 h compares the hours since its merge with the same hours a week before', () => {
    const merged = NOW - 10 * H
    const m = metrics({
      api_5xx: {
        svcplanning: hourly((t) => {
          if (t >= merged - (merged % H)) {
            return 3
          }
          return t >= NOW - 7 * DAY && t < NOW - 6 * DAY ? 50 : 0
        }),
      },
    })
    const { releases } = topicsOf(
      engineInput({ metrics: m, releases: [release('svc-planning', 10, '2.5.0', merged)] }),
    )
    expect(releases).toEqual([expect.objectContaining({ n: 10, verdict: 'tooRecent', why: ['5xx'] })])
  })

  test('a release without 7 days of metrics before it is flat', () => {
    const merged = MIDNIGHT - 5 * DAY
    const m = metrics({ api_5xx: { svcplanning: hourly((t) => (t >= merged ? 5 : 0)) } })
    const { releases } = topicsOf(engineInput({ from: MIDNIGHT - 10 * DAY, metrics: m, releases: [release('svc-planning', 4, '1.2.0', merged)] }))
    expect(releases).toEqual([expect.objectContaining({ n: 4, verdict: 'steady', why: [] })])
  })

  test("only the releases of the last 14 days of a service's repository are listed, oldest first", () => {
    const rows = [
      release('svc-planning', 2, '1.1.0', MIDNIGHT - 2 * DAY),
      release('svc-planning', 1, '1.0.0', MIDNIGHT - 16 * DAY),
      release('svc-other', 3, '9.0.0', MIDNIGHT - 2 * DAY),
      { ...release('svc-planning', 5, '', MIDNIGHT - DAY), title: 'Hotfix export' },
      release('svc-planning', 4, '1.2.0', MIDNIGHT - 13 * DAY),
    ]
    const listed = topicsOf(engineInput({ releases: rows })).releases.map((r) => [r.n, r.v])
    expect(listed).toEqual([
      [4, 'v1.2.0'],
      [2, 'v1.1.0'],
      [5, '#5'],
    ])
  })

  test('a version is read from a release title of any case, with or without a component, else the number', () => {
    const titled = (n: number, title: string) => ({ ...release('svc-planning', n, '', MIDNIGHT - DAY), title })
    const rows = [
      titled(1, 'chore(main): release v2.4.0'),
      titled(2, 'chore(main): Release svc-planning 2.5.1'),
      titled(3, 'RELEASE planning-api v3.0.0'),
      titled(4, 'release 2'),
      titled(5, 'Release sandbox to staging'),
    ]
    expect(topicsOf(engineInput({ releases: rows })).releases.map((r) => r.v)).toEqual([
      'v2.4.0',
      'v2.5.1',
      'v3.0.0',
      '#4',
      '#5',
    ])
  })
})
