import type { DatadogSnapshot } from '../snapshot'
import { isProd, serviceOf } from '../scope'
import { DAY, HOUR, WEEK, at, between, filled, lastWeek, middle, ms, span, total, weekBefore, type Signals, type Window } from './series'

type Signal = '5xx' | 'lerr' | 'p95'
type Why = { kind: '5xx' | 'p95' | 'fn'; value: number; fn?: string }
type Trigger = DatadogSnapshot['events']['items'][number]
type StoryStep =
  | { ts: number; type: 'release'; label: string }
  | { ts: number; type: 'first_error' }
  | { ts: number; type: 'monitor'; label: string }
  | { ts: number; type: 'slow'; value: number }
  | { ts: number; type: 'last_error' }

export type Day = { d: number; bad: boolean; why: Why[] }

export type Release = {
  svc: string
  repo: string
  n: number
  sha: string
  v: string
  ts: number
  changes: string[]
  verdict: 'regressed' | 'steady' | 'tooRecent'
  why: Signal[]
}

export type Problem = {
  id: string
  kind: 'pb'
  type: 'problem'
  svc: string
  since: number
  why: Signal[]
  cause: null | { n: number; v: string; repo: string; ts: number; delay_min: number | null }
  cmp: { e5: null | [number, number]; p95: [number | null, number | null]; lerr: [number, number]; count: [number, number] }
  last_error: number | null
  linked: { id: number; name: string }[]
  story: StoryStep[]
  value: number
}

export type EngineInput = {
  now: number
  from: number
  metrics: DatadogSnapshot['metrics'] | null
  services: { name: string; repo: string }[]
  monitors: DatadogSnapshot['monitors']
  triggers: Trigger[] | null
  releases: { repo: string; number: number; sha: string; title: string; merged: string; changes: string[] }[]
}

type Monitor = { id: number; name: string }
type Rise = { why: Signal[]; e5: [number, number]; lerr: [number, number]; p95: [number | null, number | null] }

export const NOW_BAR = { min5: 20, mine: 100 }
export const DAY_BAR = { min5: 5, mine: 30 }
const NOISY = 50
const TOO_RECENT = 72 * HOUR

export function rise(s: Signals, w: Window, a: number, b: number, bar = NOW_BAR): Rise {
  const pair = <T>(xs: (number | null)[], f: (v: (number | null)[]) => T): [T, T] => [f(between(xs, w, a - WEEK, b - WEEK)), f(between(xs, w, a, b))]
  const [e5, lerr, p95] = [pair(s.e5, total), pair(s.lerr, total), pair(s.p95, middle)]
  const why: Signal[] = []
  if (e5[1] >= 3 * Math.max(e5[0], 1) && e5[1] - e5[0] >= bar.min5) {
    why.push('5xx')
  }
  if (lerr[1] >= 1.5 * Math.max(lerr[0], 1) && lerr[1] - lerr[0] >= bar.mine) {
    why.push('lerr')
  }
  if (p95[1] && p95[0] && p95[1] >= 1.5 * p95[0]) {
    why.push('p95')
  }
  return { why, e5, lerr, p95 }
}

const versionOf = (title: string, n: number) => {
  const m = /\brelease\s+(?:\S+\s+)?v?(\d+\.\d+\.\d+)/i.exec(title)
  return m ? `v${m[1]}` : `#${n}`
}

type ReleaseRow = EngineInput['releases'][number]

function judged(svc: string, r: ReleaseRow, s: Signals, w: Window): Release {
  const ts = Math.floor(Date.parse(r.merged) / 1000)
  const { why } = rise(s, w, ts, Math.min(ts + 72 * HOUR, w.now))
  const reg = why.length > 0 && ts >= w.from + WEEK
  const verdict = w.now - ts < TOO_RECENT ? 'tooRecent' : reg ? 'regressed' : 'steady'
  return { svc, repo: r.repo, n: r.number, sha: r.sha, v: versionOf(r.title, r.number), ts, changes: r.changes, verdict, why: reg ? why : [] }
}

export function judgeReleases(releases: EngineInput['releases'], services: { name: string; repo: string; s: Signals }[], w: Window): Release[] {
  return services.flatMap(({ name, repo, s }) =>
    releases
      .filter((r) => r.repo === repo)
      .map((r) => judged(name, r, s, w))
      .sort((a, b) => a.ts - b.ts),
  )
}

function whyOfDay(s: Signals, w: Window, d: number, base: { e5: number; p95: number | null; fns: Map<string, number> }) {
  const ofDay = <T>(xs: T[]) => span(xs, at(w, d), at(w, d) + 24)
  const why: Why[] = []
  const [e5, p95] = [total(ofDay(s.e5)), middle(ofDay(s.p95))]
  if (e5 >= 3 * Math.max(base.e5, 1) && e5 >= 10) {
    why.push({ kind: '5xx', value: e5 })
  }
  if (p95 && base.p95 && p95 >= 1.5 * base.p95) {
    why.push({ kind: 'p95', value: Math.round(p95) })
  }
  const k = w.days.indexOf(d)
  for (const [fn, f] of s.fns) {
    const err = f.err[k] ?? 0
    if (err >= 3 * Math.max(base.fns.get(fn) ?? 0, 1) && err >= 100) {
      why.push({ kind: 'fn', fn, value: err })
    }
  }
  return why
}

export function dayStates(s: Signals, w: Window): Day[] {
  const ofDay = <T>(xs: T[], d: number) => span(xs, at(w, d), at(w, d) + 24)
  const base = {
    e5: middle(w.base.map((d) => total(ofDay(s.e5, d)))) ?? 0,
    p95: middle(w.base.map((d) => middle(ofDay(s.p95, d)))),
    fns: new Map([...s.fns].map(([fn, f]) => [fn, middle(w.base.map((d) => f.err[w.days.indexOf(d)])) ?? 0])),
  }
  return w.shown.map((d) => {
    const why = whyOfDay(s, w, d, base)
    return { d, bad: why.length > 0, why }
  })
}

const unprefixed = (name: string) => name.replace(/^(?:\[[^\]]*\]\s*)+/, '')

export function serviceMonitors(monitors: EngineInput['monitors'], svc: string): Monitor[] {
  const out = new Map<number, Monitor>()
  for (const m of monitors) {
    if (isProd(m.tags) && serviceOf(m) === svc.toLowerCase()) {
      out.set(m.id, { id: m.id, name: unprefixed(m.name) })
    }
  }
  return [...out.values()]
}

export function noisyMonitors(triggers: Trigger[] | null, now: number): Set<number> {
  const rang = new Map<number, number>()
  for (const t of triggers ?? []) {
    if (t.ts >= now - WEEK) {
      rang.set(t.monitor_id, (rang.get(t.monitor_id) ?? 0) + 1)
    }
  }
  return new Set([...rang].filter(([, count]) => count >= NOISY).map(([id]) => id))
}

export type ServiceContext = {
  svc: string
  s: Signals
  w: Window
  days: Day[]
  releases: Release[]
  monitors: Monitor[]
  triggers: Trigger[] | null
}

type Errors = { first: number | null; last: number | null }

function errorHours(s: Signals, w: Window, t0: number): Errors {
  const i0 = at(w, t0)
  let first: number | null = null
  let last: number | null = null
  for (const [i, v] of filled(s.measured.includes('api') ? s.e5 : s.lerr).entries()) {
    if (i >= i0 && v > 0) {
      first ??= w.from + i * HOUR
      if (i > i0) {
        last = w.from + i * HOUR
      }
    }
  }
  return { first, last }
}

function slowFrom(s: Signals, w: Window, t0: number): StoryStep | null {
  const i0 = at(w, t0)
  const base = middle(span(s.p95, i0 - 168, i0))
  for (let i = Math.max(i0, 0); i < s.p95.length; i++) {
    const p = s.p95[i]
    if (p && base && p >= 3 * base) {
      return { ts: w.from + i * HOUR, type: 'slow', value: Math.round(p) }
    }
  }
  return null
}

type Linked = { ts: number; id: number; name: string }

function linkedFrom(x: ServiceContext, t0: number): Linked[] {
  const names = new Map(x.monitors.map((m) => [m.id, m.name]))
  const rang = (x.triggers ?? []).flatMap(({ monitor_id: id, ts }) => {
    const name = names.get(id)
    return name === undefined ? [] : [{ id, ts, name }]
  })
  const before = new Set(rang.filter((t) => t.ts < t0 && t.ts >= t0 - 72 * HOUR).map((t) => t.id))
  const first = new Map<number, Linked>()
  for (const t of rang) {
    if (t.ts >= t0 && !before.has(t.id) && t.ts < (first.get(t.id)?.ts ?? Infinity)) {
      first.set(t.id, t)
    }
  }
  return [...first.values()].sort((a, b) => a.ts - b.ts || a.name.localeCompare(b.name))
}

function storyOf(x: ServiceContext, t0: number, cause: Release | null, linked: Linked[], errors: Errors): StoryStep[] {
  const { first, last } = errors
  const slow = slowFrom(x.s, x.w, t0)
  const story: StoryStep[] = [
    ...(cause ? [{ ts: cause.ts, type: 'release' as const, label: cause.v }] : []),
    ...(first !== null ? [{ ts: first, type: 'first_error' as const }] : []),
    ...linked.slice(0, 4).map(({ ts, name }) => ({ ts, type: 'monitor' as const, label: name })),
    ...(slow ? [slow] : []),
  ].sort((a, b) => a.ts - b.ts)
  return last !== null ? [...story, { ts: last, type: 'last_error' as const }] : story
}

const causeOf = (cause: Release | null, first: number | null): Problem['cause'] =>
  cause && {
    n: cause.n,
    v: cause.v,
    repo: cause.repo,
    ts: cause.ts,
    delay_min: first !== null ? Math.max(Math.floor((first - cause.ts) / 60), 0) : null,
  }

function badDaysStart(days: Day[]): number | null {
  let [start, measured] = [0, false]
  for (const [k, day] of [...days].reverse().entries()) {
    if (k > 0 && !day.bad) {
      break
    }
    start = day.d
    measured ||= day.bad
  }
  return measured ? start : null
}

function riseStart(s: Signals, w: Window, r72: Rise): number {
  const slow = 1.5 * (r72.p95[0] ?? 0)
  const [series, rose] = r72.why.includes('5xx')
    ? [s.e5, (v: number) => v > 0]
    : r72.why.includes('lerr')
      ? [s.lerr, (v: number) => v > 0]
      : [s.p95, (v: number) => v >= slow]
  const i0 = Math.max(at(w, w.now - 72 * HOUR), 0)
  const i = series.findIndex((v, k) => k >= i0 && v !== null && rose(v))
  return i >= 0 ? w.from + i * HOUR : w.now - 72 * HOUR
}

export function problemOf(x: ServiceContext): Problem | null {
  const { s, w } = x
  const r72 = rise(s, w, w.now - 72 * HOUR, w.now)
  if (!r72.why.length || !rise(s, w, w.now - 24 * HOUR, w.now, DAY_BAR).why.length) {
    return null
  }
  const start = badDaysStart(x.days) ?? riseStart(s, w, r72)
  const latest = x.releases.filter((r) => r.why.length > 0 && r.ts <= start + DAY).sort((a, b) => b.ts - a.ts)
  const cause = latest.at(0) ?? null
  const t0 = cause?.ts ?? start
  const linked = linkedFrom(x, t0)
  const errors = errorHours(s, w, t0)
  const week = rise(s, w, w.now - WEEK, w.now)
  return {
    id: `pb:${x.svc}`,
    kind: 'pb',
    type: 'problem',
    svc: x.svc,
    since: t0,
    why: r72.why,
    cause: causeOf(cause, errors.first),
    cmp: {
      e5: s.read.e5 ? week.e5 : null,
      p95: [ms(r72.p95[0]), ms(r72.p95[1])],
      lerr: week.lerr,
      count: [total(weekBefore(s.count, w)), total(lastWeek(s.count, w))],
    },
    last_error: errors.last,
    linked: linked.map(({ id, name }) => ({ id, name })),
    story: storyOf(x, t0, cause, linked, errors),
    value: r72.e5[1],
  }
}
