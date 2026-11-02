import type { DatadogSnapshot } from '../snapshot'
import type { MetricKey } from '../scope'

export const HOUR = 3600
export const DAY = 86400
export const WEEK = 7 * DAY
const METRIC_DAYS = 21
const SHOWN_DAYS = 14
const PROD = '-prod'

type Points = [number, number][]
type Keyed = Record<string, Points>
type Metrics = Record<MetricKey, Keyed | null>
type Series = NonNullable<DatadogSnapshot['metrics'][MetricKey]>[number]
type Hourly = (number | null)[]

export type Window = { from: number; now: number; n: number; days: number[]; shown: number[]; base: number[] }

export function windowOf(from: number, now: number): Window {
  const first = from - (from % DAY)
  const days = Array.from({ length: METRIC_DAYS + 1 }, (_, k) => first + DAY * (k + 1)).filter((d) => d < now)
  const shown = days.slice(-SHOWN_DAYS)
  const base = days.filter((d) => d < shown[0]).slice(-7)
  return { from, now, n: Math.max(Math.ceil((now - from) / HOUR), 0), days, shown, base }
}

const tagOf = (tags: string[], name: string): string | null => {
  const tag = tags.find((t) => t.startsWith(`${name}:`))
  return tag === undefined ? null : tag.slice(name.length + 1)
}
const stripProd = (s: string) => (s.endsWith(PROD) ? s.slice(0, -PROD.length) : s)

type KeyOf = (tags: string[]) => string | null
const byService: KeyOf = (tags) => tagOf(tags, 'service')?.toLowerCase() || null
const byName: KeyOf = (tags) => {
  const name = tagOf(tags, 'name')
  return name ? stripProd(name.toLowerCase()) : null
}
const byFunction: KeyOf = (tags) => {
  const service = byService(tags)
  const fn = tagOf(tags, 'functionname')?.toLowerCase()
  if (!service || !fn) {
    return null
  }
  return `${service}|${stripProd(fn.startsWith(`${service}-`) ? fn.slice(service.length + 1) : fn)}`
}
const byRoute =
  (names: string[]): KeyOf =>
  (tags) => {
    const service = byService(tags)
    const rest = names.map((n) => tagOf(tags, n))
    return service && rest.every((p) => p !== null) ? [service, ...rest].join('|') : null
  }
const byQueue: KeyOf = (tags) => tagOf(tags, 'queuename')?.toLowerCase() || null

function keyed(series: Series[] | null, keyOf: KeyOf): Keyed | null {
  if (series === null) {
    return null
  }
  const out: Keyed = {}
  for (const s of series) {
    const key = keyOf(s.tag_set)
    if (key) {
      out[key] = s.pointlist.flatMap(([t, v]): Points => (v === null ? [] : [[Math.floor(t / 1000), v]]))
    }
  }
  return out
}

export function keyedOf(m: DatadogSnapshot['metrics']): Metrics {
  const route = byRoute(['resource_name'])
  return {
    api_count: keyed(m.api_count, byName),
    api_5xx: keyed(m.api_5xx, byName),
    api_4xx: keyed(m.api_4xx, byName),
    api_p95: keyed(m.api_p95, byName),
    lambda_errors: keyed(m.lambda_errors, byService),
    fn_invocations: keyed(m.fn_invocations, byFunction),
    fn_errors: keyed(m.fn_errors, byFunction),
    apm_hits: keyed(m.apm_hits, route),
    apm_p95: keyed(m.apm_p95, route),
    apm_status: keyed(m.apm_status, byRoute(['resource_name', 'http.status_class'])),
    dlq: keyed(m.dlq, byQueue),
  }
}

const median = (xs: number[]): number | null => {
  const s = [...xs].sort((a, b) => a - b)
  const half = Math.floor(s.length / 2)
  if (s.length === 0) {
    return null
  }
  return s.length % 2 ? s[half] : (s[half - 1] + s[half]) / 2
}

export const at = (w: Window, t: number) => Math.floor((t - w.from) / HOUR)
export const span = <T>(xs: T[], i: number, j: number): T[] => xs.slice(Math.max(i, 0), Math.max(j, 0))
export const between = <T>(xs: T[], w: Window, a: number, b: number): T[] => span(xs, at(w, a), at(w, b))
export const total = (xs: Hourly): number => xs.reduce<number>((s, x) => s + (x ?? 0), 0)
export const middle = (xs: Hourly): number | null => median(xs.filter((x): x is number => x !== null))
export const filled = (xs: Hourly): number[] => xs.map((x) => x ?? 0)
export const ms = (v: number | null): number | null => (v === null ? null : Math.round(v))
export const tenth = (v: number): number => Math.round(v * 10) / 10
export const lastWeek = <T>(xs: T[], w: Window): T[] => between(xs, w, w.now - WEEK, w.now)
export const weekBefore = <T>(xs: T[], w: Window): T[] => between(xs, w, w.now - 2 * WEEK, w.now - WEEK)

function aligned(points: Points | undefined, w: Window): Hourly {
  if (!points) {
    return []
  }
  const out: Hourly = new Array<number | null>(w.n).fill(null)
  for (const [t, v] of points) {
    const i = at(w, t)
    if (i >= 0 && i < w.n) {
      out[i] = v
    }
  }
  return out
}

function byDay(points: Points | undefined, days: number[], scale = 1): Hourly {
  const values = new Map((points ?? []).map(([t, v]) => [t - (t % DAY), v * scale]))
  return days.map((d) => values.get(d) ?? null)
}

export type FnSignal = { err: number[]; inv: number[] }
export type RouteSignal = { hits: Hourly; p95: Hourly; status: Record<string, Hourly> }
export type QueueSignal = { points: Points }
type Measure = 'api' | 'lambda' | 'apm'
export type Signals = {
  measured: Measure[]
  read: { e5: boolean }
  count: Hourly
  e5: Hourly
  p95: Hourly
  lerr: Hourly
  fns: Map<string, FnSignal>
  routes: Map<string, RouteSignal>
  queues: Map<string, QueueSignal>
}

const suffixes = (m: Keyed | null, prefix: string) =>
  Object.keys(m ?? {})
    .filter((k) => k.startsWith(prefix))
    .map((k) => k.slice(prefix.length))
const sorted = (...lists: string[][]) => [...new Set(lists.flat())].sort()

function fnsOf(m: Metrics, svc: string, w: Window): Map<string, FnSignal> {
  const p = `${svc}|`
  const names = sorted(suffixes(m.fn_errors, p), suffixes(m.fn_invocations, p))
  const daily = (src: Keyed | null, f: string) => filled(byDay(src?.[p + f], w.days))
  return new Map(names.map((f) => [f, { err: daily(m.fn_errors, f), inv: daily(m.fn_invocations, f) }]))
}

function routesOf(m: Metrics, svc: string, w: Window): Map<string, RouteSignal> {
  const p = `${svc}|`
  const keyedStatus = suffixes(m.apm_status, p).map((k): [string, string] => [k.slice(0, k.lastIndexOf('|')), k.slice(k.lastIndexOf('|') + 1)])
  const names = sorted(
    suffixes(m.apm_hits, p),
    keyedStatus.map(([r]) => r),
  )
  const signal = (r: string): RouteSignal => ({
    hits: byDay(m.apm_hits?.[p + r], w.shown),
    p95: byDay(m.apm_p95?.[p + r], w.shown, 1000),
    status: Object.fromEntries(keyedStatus.filter(([k]) => k === r).map(([, c]) => [c, byDay(m.apm_status?.[`${p}${r}|${c}`], w.shown)])),
  })
  return new Map(names.map((r) => [r, signal(r)]))
}

const ownerOf = (queue: string, services: string[]) =>
  services.filter((s) => queue.startsWith(`${s}-`)).reduce<string | null>((a, s) => (a && a.length >= s.length ? a : s), null)

function queuesOf(m: Metrics, svc: string, services: string[]): Map<string, QueueSignal> {
  const owned = Object.entries(m.dlq ?? {})
    .filter(([q]) => ownerOf(q, services) === svc)
    .sort(([a], [b]) => (a < b ? -1 : 1))
  return new Map(owned.map(([q, raw]) => [q, { points: [...raw].sort((a, b) => a[0] - b[0]) }]))
}

const pointed = (xs: Hourly) => xs.some((x) => x !== null)
const pointedOn = (src: Keyed | null, prefix: string, days: number[]) =>
  Object.entries(src ?? {}).some(([k, points]) => k.startsWith(prefix) && pointed(byDay(points, days)))

function measuredOf(m: Metrics, svc: string, w: Window, s: Omit<Signals, 'measured'>): Measure[] {
  const p = `${svc}|`
  const has: Record<Measure, boolean> = {
    api: pointed(s.count) && pointed(s.e5),
    lambda: pointed(s.lerr) || [m.fn_invocations, m.fn_errors].some((src) => pointedOn(src, p, w.days)),
    apm: [m.apm_hits, m.apm_p95, m.apm_status].some((src) => pointedOn(src, p, w.shown)),
  }
  return (['api', 'lambda', 'apm'] as const).filter((k) => has[k])
}

const NO_SIGNALS: Signals = {
  measured: [],
  read: { e5: false },
  count: [],
  e5: [],
  p95: [],
  lerr: [],
  fns: new Map(),
  routes: new Map(),
  queues: new Map(),
}

export function signalsOf(m: Metrics | null, name: string, w: Window, services = [name]): Signals {
  if (!m) {
    return NO_SIGNALS
  }
  const [svc, lowered] = [name.toLowerCase(), services.map((x) => x.toLowerCase())]
  const s = {
    read: { e5: m.api_5xx !== null },
    count: aligned(m.api_count?.[svc], w),
    e5: aligned(m.api_5xx?.[svc], w),
    p95: aligned(m.api_p95?.[svc], w),
    lerr: aligned(m.lambda_errors?.[svc], w),
    fns: fnsOf(m, svc, w),
    routes: routesOf(m, svc, w),
    queues: queuesOf(m, svc, lowered),
  }
  return { measured: measuredOf(m, svc, w, s), ...s }
}
