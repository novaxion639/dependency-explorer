import { DAY, HOUR, at, filled, keyedOf, middle, ms, signalsOf, span, tenth, total, windowOf, type FnSignal, type QueueSignal, type RouteSignal, type Signals, type Window } from './series'
import { dayStates, judgeReleases, problemOf, serviceMonitors, type Day, type EngineInput, type Problem, type Release, type ServiceContext } from './rules'

type Why = Day['why'][number]
type Topic =
  | Problem
  | { id: string; kind: 'dg'; type: 'route'; svc: string; route: string; share: number; share_prev: number; p95: number | null; value: number }
  | { id: string; kind: 'dg'; type: 'fn_broken'; svc: string; fn: string; err: number; inv: number; err_prev: number; swagger: boolean; value: number }
  | { id: string; kind: 'dg'; type: 'fn_chronic'; svc: string; fn: string; rate: number; per_day: number; value: number }
  | { id: string; kind: 'dg'; type: 'dlq'; svc: string; queue: string; count: number; expiring: null | { last_in: number; expires: number }; value: number }
  | { id: string; kind: 'rs'; type: 'day'; svc: string; day: number; why: Why[]; hours: null | [number, number]; release: null | { n: number; v: string }; value: 0 }

type ServiceView = { name: string; repo: string; status: 'pb' | 'dg' | 'ok'; measured: Signals['measured']; days: Day[] }

const MIN_CALLS = 50
const QUEUE_RETENTION = 14 * DAY
const RELEASE_DAYS = 14

const sumOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

const routeName = (r: string) => r.replace(/^(get|post|put|patch|delete)_/, (_, verb: string) => `${verb.toUpperCase()} `)

function routeWeek(r: RouteSignal, week: 0 | 1) {
  const days = (xs: (number | null)[]) => xs.slice(week * 7, week * 7 + 7)
  const calls = total(Object.values(r.status).map((xs) => total(days(xs))))
  const e5 = total(days(r.status['5xx'] ?? []))
  return { p95: middle(days(r.p95)), calls, share: calls ? (100 * e5) / calls : 0 }
}

const fnWeek = (f: FnSignal) => ({ inv: sumOf(f.inv.slice(-7)), err: sumOf(f.err.slice(-7)), err_prev: sumOf(f.err.slice(-14, -7)) })

function routeTopics(svc: string, s: Signals): Topic[] {
  return [...s.routes].flatMap(([r, signal]): Topic[] => {
    const [prev, last] = [routeWeek(signal, 0), routeWeek(signal, 1)]
    if (prev.calls < MIN_CALLS || last.calls < MIN_CALLS || prev.share <= 2 || last.share <= 2) {
      return []
    }
    const route = routeName(r)
    const share = tenth(last.share)
    return [{ id: `route:${svc}:${route}`, kind: 'dg', type: 'route', svc, route, share, share_prev: tenth(prev.share), p95: ms(last.p95), value: share }]
  })
}

function fnTopic(svc: string, fn: string, f: FnSignal): Topic | null {
  const { inv, err, err_prev } = fnWeek(f)
  if (!inv) {
    return null
  }
  const [id, rate] = [`fn:${svc}:${fn}`, (100 * err) / inv]
  if (rate >= 50 && inv >= 10) {
    return { id, kind: 'dg', type: 'fn_broken', svc, fn, err, inv, err_prev, swagger: fn.includes('swagger'), value: tenth(rate) }
  }
  const perDay = middle(f.err.slice(-7)) ?? 0
  if (rate >= 10 && inv >= 100 && perDay < 1.5 * Math.max(middle(f.err.slice(-14, -7)) ?? 0, 1)) {
    return { id, kind: 'dg', type: 'fn_chronic', svc, fn, rate: tenth(rate), per_day: perDay, value: tenth(rate) }
  }
  return null
}

function queueTopic(svc: string, queue: string, q: QueueSignal, now: number): Topic | null {
  const [times, values] = [q.points.map(([t]) => t), q.points.map(([, v]) => v)]
  const recent = q.points.filter(([t]) => t >= now - 72 * HOUR)
  const count = values.at(-1) ?? 0
  if (count <= 0 || !recent.length || recent.some(([, v]) => v <= 0)) {
    return null
  }
  const ups = times.filter((_, i) => i > 0 && values[i] > values[i - 1])
  const lastIn = ups.at(-1) ?? times[0]
  const falls = times.some((t, i) => i > 0 && values[i] < values[i - 1] && t > lastIn)
  const expiring = falls && lastIn < now - 3 * DAY ? { last_in: lastIn, expires: lastIn + QUEUE_RETENTION } : null
  return { id: `dlq:${queue}`, kind: 'dg', type: 'dlq', svc, queue, count, expiring, value: count }
}

function digsOf(svc: string, s: Signals, now: number): Topic[] {
  return [
    ...routeTopics(svc, s),
    ...[...s.fns].map(([fn, f]) => fnTopic(svc, fn, f)),
    ...[...s.queues].map(([queue, q]) => queueTopic(svc, queue, q, now)),
  ].filter((t): t is Topic => t !== null)
}

function errorSpan(s: Signals, w: Window, d: number): [number, number] | null {
  const i0 = Math.max(at(w, d), 0)
  const hours = span(filled(s.e5), i0, at(w, d) + 24)
  const peak = Math.max(0, ...hours)
  const lit = hours.flatMap((v, k) => (v > 0 && v >= 0.1 * peak ? [w.from + (i0 + k) * HOUR] : []))
  return lit.length ? [lit[0], lit[lit.length - 1] + HOUR] : null
}

function fallenBack(x: ServiceContext, problem: Problem | null): Topic[] {
  return x.days.slice(-7).flatMap((day): Topic[] => {
    if (!day.bad || day.d >= x.w.now - DAY || (problem && day.d >= problem.since - DAY)) {
      return []
    }
    const rel = x.releases.findLast((r) => day.d - 2 * DAY <= r.ts && r.ts < day.d + DAY)
    const hours = day.why.some((y) => y.kind === '5xx') ? errorSpan(x.s, x.w, day.d) : null
    const release = rel ? { n: rel.n, v: rel.v } : null
    return [{ id: `rs:${x.svc}:${day.d}`, kind: 'rs', type: 'day', svc: x.svc, day: day.d, why: day.why, hours, release, value: 0 }]
  })
}

type Judged = EngineInput['services'][number] & { s: Signals }

function judgeService(input: EngineInput, svc: Judged, w: Window, releases: Release[]) {
  const { name, repo, s } = svc
  const days = dayStates(s, w)
  const x: ServiceContext = { svc: name, s, w, days, releases: releases.filter((r) => r.svc === name), monitors: serviceMonitors(input.monitors, name), triggers: input.triggers }
  const problem = problemOf(x)
  const digs = digsOf(name, s, w.now)
  const status = problem ? 'pb' : digs.length ? 'dg' : 'ok'
  const today = (d: Day) => (status === 'pb' ? { ...d, bad: true } : { ...d, bad: false, why: [] })
  const shown = days.map((d, i) => (i === days.length - 1 ? today(d) : d))
  const view: ServiceView = { name, repo, status, measured: s.measured, days: shown }
  return { view, topics: [...(problem ? [problem] : []), ...digs, ...fallenBack(x, problem)] }
}

export function topicsOf(input: EngineInput): { services: ServiceView[]; topics: Topic[]; releases: Release[] } {
  const w = windowOf(input.from, input.now)
  const metrics = input.metrics && keyedOf(input.metrics)
  const names = input.services.map((svc) => svc.name)
  const services: Judged[] = input.services.map((svc) => ({ ...svc, s: signalsOf(metrics, svc.name, w, names) }))
  const releases = judgeReleases(input.releases, services, w).filter((r) => r.ts >= input.now - RELEASE_DAYS * DAY)
  const judged = services.map((svc) => judgeService(input, svc, w, releases))
  return { services: judged.map((j) => j.view), topics: judged.flatMap((j) => j.topics), releases }
}
