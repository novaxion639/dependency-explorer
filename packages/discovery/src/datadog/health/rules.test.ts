import { describe, expect, test } from 'vitest'
import { DAY, FROM, H, NOW, hourly, metrics, type KeyedMetrics } from './__fixtures__/fake-metrics'
import { keyedOf, signalsOf, windowOf } from './series'
import { DAY_BAR, NOW_BAR, noisyMonitors, rise } from './rules'

const W = windowOf(FROM, NOW)
const LAST = NOW - 72 * H
const HOUR_OF_LAST = LAST - (LAST % H)
const twoWeeks = (now: number, before: number) =>
  hourly((t) => (t >= HOUR_OF_LAST ? now : t >= HOUR_OF_LAST - 7 * DAY && t < NOW - 7 * DAY ? before : 0))
const riseOf = (over: KeyedMetrics) => rise(signalsOf(keyedOf(metrics(over)), 'svcplanning', W), W, LAST, NOW).why

test('the bars of a problem now and of a day are the cockpit ones', () => {
  expect(NOW_BAR).toEqual({ min5: 20, mine: 100 })
  expect(DAY_BAR).toEqual({ min5: 5, mine: 30 })
})

describe('a rise against the same hours a week before', () => {
  test('5xx count at 3 times the week before and 20 more', () => {
    expect(riseOf({ api_5xx: { svcplanning: twoWeeks(1, 0) } })).toEqual(['5xx'])
    expect(riseOf({ api_5xx: { svcplanning: twoWeeks(0.25, 0) } })).toEqual([])
    expect(riseOf({ api_5xx: { svcplanning: twoWeeks(1, 0.5) } })).toEqual([])
  })

  test('Lambda errors count at 1.5 times the week before and 100 more', () => {
    expect(riseOf({ lambda_errors: { svcplanning: twoWeeks(6, 4) } })).toEqual(['lerr'])
    expect(riseOf({ lambda_errors: { svcplanning: twoWeeks(1.5, 1) } })).toEqual([])
    expect(riseOf({ lambda_errors: { svcplanning: twoWeeks(10, 8) } })).toEqual([])
  })

  test('the median hourly p95 counts at 1.5 times the week before', () => {
    expect(riseOf({ api_p95: { svcplanning: twoWeeks(300, 200) } })).toEqual(['p95'])
    expect(riseOf({ api_p95: { svcplanning: twoWeeks(290, 200) } })).toEqual([])
  })

  test('a service without an API Gateway only rises on its Lambda errors', () => {
    expect(riseOf({ lambda_errors: { svcplanning: twoWeeks(6, 4) }, api_5xx: null, api_p95: null })).toEqual(['lerr'])
    expect(rise(signalsOf(null, 'svcplanning', W), W, LAST, NOW)).toEqual({
      why: [],
      e5: [0, 0],
      lerr: [0, 0],
      p95: [null, null],
    })
  })
})

test('a monitor that rang 50 times in 7 days is noisy, 49 times or earlier is not', () => {
  const rang = (id: number, times: number, at: number) => Array.from({ length: times }, () => ({ monitor_id: id, ts: at, status: 'error' }))
  const triggers = [...rang(1, 50, NOW - DAY), ...rang(2, 49, NOW - DAY), ...rang(3, 50, NOW - 8 * DAY)]
  expect([...noisyMonitors(triggers, NOW)]).toEqual([1])
  expect(noisyMonitors(null, NOW).size).toBe(0)
})
