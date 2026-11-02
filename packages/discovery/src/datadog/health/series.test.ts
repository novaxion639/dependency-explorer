import { expect, test } from 'vitest'
import { DAY, FROM, H, MIDNIGHT, NOW, metrics } from './__fixtures__/fake-metrics'
import { between, keyedOf, signalsOf, windowOf } from './series'

test('the window shows the last 14 UTC days, today cut at now, after a 7 day baseline', () => {
  const w = windowOf(FROM, NOW)
  expect(w.n).toBe(505)
  expect(w.days).toHaveLength(21)
  expect(w.shown).toEqual(Array.from({ length: 14 }, (_, k) => MIDNIGHT - (13 - k) * DAY))
  expect(w.base).toEqual(Array.from({ length: 7 }, (_, k) => MIDNIGHT - (20 - k) * DAY))
})

test("a span of hours is cut at the window's edges, the hour of now left out", () => {
  const w = windowOf(FROM, NOW)
  const xs = Array.from({ length: w.n }, (_, i) => i)
  expect(between(xs, w, NOW - 3 * H, NOW)).toEqual([501, 502, 503])
  expect(between(xs, w, FROM - DAY, FROM + 2 * H)).toEqual([0, 1])
})

test('the series of a service are aligned on the window, daily ones on its days, APM p95 in ms', () => {
  const w = windowOf(FROM, NOW)
  const m = metrics({
    api_5xx: {
      svcplanning: [
        [FROM + H, 4],
        [FROM - H, 9],
        [NOW + H, 9],
      ],
    },
    fn_errors: { 'svcplanning|sync': [[MIDNIGHT - DAY, 3]], 'svcplanningx|sync': [[MIDNIGHT, 1]] },
    apm_p95: { 'svcplanning|get_/a': [[MIDNIGHT, 0.5]] },
    apm_status: { 'svcplanning|get_/a|5xx': [[MIDNIGHT, 2]] },
    dlq: {
      'svcplanning-syncdlq-prod': [
        [FROM + 2 * H, 1],
        [FROM + H, 3],
      ],
      'svcplanningx-dlq-prod': [[FROM, 1]],
    },
  })
  const s = signalsOf(keyedOf(m), 'svcplanning', w)
  expect(s.e5.slice(0, 3)).toEqual([null, 4, null])
  expect(s.e5).toHaveLength(505)
  expect(s.count).toEqual([])
  expect([...s.fns.keys()]).toEqual(['sync'])
  expect(s.fns.get('sync')?.err.slice(-2)).toEqual([3, 0])
  expect(s.fns.get('sync')?.inv).toEqual(Array(21).fill(0))
  expect(s.routes.get('get_/a')).toEqual({
    hits: Array<null>(14).fill(null),
    p95: [...Array<null>(13).fill(null), 500],
    status: { '5xx': [...Array<null>(13).fill(null), 2] },
  })
  expect([...s.queues.keys()]).toEqual(['svcplanning-syncdlq-prod'])
  expect(s.queues.get('svcplanning-syncdlq-prod')?.points).toEqual([
    [FROM + H, 3],
    [FROM + 2 * H, 1],
  ])
})

test('Datadog series are keyed as the collector keys them, null points and untagged series dropped', () => {
  const keyed = keyedOf({
    ...metrics(),
    api_count: [
      { tag_set: ['name:SvcPlanning-prod'], pointlist: [[2000, 1], [3000, null]] },
      { tag_set: [], pointlist: [[2000, 1]] },
    ],
    fn_errors: [
      { tag_set: ['service:SvcPlanning', 'functionname:other-prod'], pointlist: [] },
      { tag_set: ['service:svcplanning'], pointlist: [] },
    ],
    apm_hits: [{ tag_set: ['service:svcplanning'], pointlist: [] }],
    dlq: [{ tag_set: ['queuename:Svc-DLQ'], pointlist: [] }],
  })
  expect(keyed.api_count).toEqual({ svcplanning: [[2, 1]] })
  expect(keyed.fn_errors).toEqual({ 'svcplanning|other': [] })
  expect(keyed.apm_hits).toEqual({})
  expect(keyed.dlq).toEqual({ 'svc-dlq': [] })
  expect(keyed.api_5xx).toBeNull()
})
