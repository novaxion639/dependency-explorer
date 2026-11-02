import * as path from 'node:path'
import type { DatadogOverlay } from '@dependency-explorer/schema'
import type { DatadogJoin } from '../extractors/datadog'
import { defaultGit, productionBranch, type GitRunner } from '../pinned'
import { noisyMonitors, rise, type Day } from './health/rules'
import { DAY, RECENT, at, keyedOf, middle, ms, signalsOf, span, tenth, total, windowOf, type Signals, type Window } from './health/series'
import { topicsOf } from './health/topics'
import { releasesOf } from './releases'
import { isProd, normaliseName, rawServiceOf, rawTagValues } from './scope'
import type { DatadogSnapshot } from './snapshot'

type Engine = ReturnType<typeof topicsOf>
type Topic = Engine['topics'][number]
type ServiceOverlay = DatadogOverlay['services'][string]
type Hourly = (number | null)[]

const FORTNIGHT = 14 * DAY

const dateOf = (t: number) => new Date(t * 1000).toISOString().slice(0, 10)
const times = (before: number, after: number) => `${tenth(after / Math.max(before, 1))}×`

function problemReasons(s: Signals, w: Window): string[] {
  const r = rise(s, w, w.now - RECENT, w.now)
  return r.why.map((why) => {
    switch (why) {
      case '5xx':
        return `5xx ${times(...r.e5)} (+${r.e5[1] - r.e5[0]}) over 72 h`
      case 'lerr':
        return `Lambda errors ${times(...r.lerr)} (+${r.lerr[1] - r.lerr[0]}) over 72 h`
      case 'p95':
        return `p95 ${ms(r.p95[0])} → ${ms(r.p95[1])} ms over 72 h`
    }
  })
}

function whyOfDay(why: Day['why'][number]): string {
  switch (why.kind) {
    case '5xx':
      return `5xx ${why.value}`
    case 'p95':
      return `p95 ${why.value} ms`
    case 'fn':
      return `${why.fn} errors ${why.value}`
  }
}

function reasonsOf(t: Topic, s: Signals, w: Window): string[] {
  switch (t.type) {
    case 'problem':
      return problemReasons(s, w)
    case 'route':
      return [`${t.route} 5xx ${t.share} % of calls, ${t.share_prev} % the week before`]
    case 'fn_broken':
      return [`${t.fn} fails ${t.value} % of ${t.inv} runs`]
    case 'fn_chronic':
      return [`${t.fn} fails ${t.rate} % of runs, ${t.per_day} a day`]
    case 'dlq':
      return [`DLQ ${t.queue} above 0 for 72 h, ${t.count} now`]
    case 'day':
      return [`Fell back on ${dateOf(t.day)}: ${t.why.map(whyOfDay).join(', ')}`]
  }
}

function stateOf(topics: Topic[], measured: boolean): ServiceOverlay['state'] {
  const kinds = new Set(topics.map((t) => t.kind))
  if (kinds.has('pb')) {
    return 'problem'
  }
  if (kinds.has('dg')) {
    return 'dig'
  }
  if (kinds.has('rs')) {
    return 'fellBack'
  }
  return measured ? 'healthy' : 'noData'
}

const summed = (xs: Hourly): number | null => (xs.some((x) => x !== null) ? total(xs) : null)

function stripOf(signals: Signals[], w: Window): ServiceOverlay['strip'] {
  const ofDay = (xs: Hourly, d: number) => span(xs, at(w, d), at(w, d) + 24)
  return w.shown.map((d) => ({
    day: dateOf(d),
    requests: summed(signals.flatMap((s) => ofDay(s.count, d))),
    errors5xx: summed(signals.flatMap((s) => ofDay(s.e5, d))),
    p95ms: ms(middle(signals.flatMap((s) => ofDay(s.p95, d)))),
  }))
}

function queuesOf(snapshot: DatadogSnapshot, join: DatadogJoin, now: number): DatadogOverlay['queues'] {
  const out: DatadogOverlay['queues'] = {}
  for (const series of snapshot.metrics.dlq ?? []) {
    const id = join.queueOfDatadog.get(rawTagValues(series.tag_set, 'queuename').at(0) ?? '')
    const points = series.pointlist.flatMap(([t, v]) => (v === null ? [] : [{ t: t / 1000, v }]))
    const depthNow = points.at(-1)?.v
    if (id === undefined || depthNow === undefined) {
      continue
    }
    const depthMax14d = Math.max(...points.filter((p) => p.t >= now - FORTNIGHT).map((p) => p.v), depthNow)
    out[id] = { depthNow, depthMax14d }
  }
  return out
}

export function buildOverlay(snapshot: DatadogSnapshot, join: DatadogJoin, engine: Engine, now: Date): DatadogOverlay {
  const to = Math.floor(now.getTime() / 1000)
  const w = windowOf(snapshot.meta.from, to)
  const metrics = keyedOf(snapshot.metrics)
  const site = snapshot.meta.site
  const noisy = noisyMonitors(snapshot.events.items, to)
  const mapServiceOf = (item: { tags: string[]; name: string }) => join.serviceOfDatadog.get(rawServiceOf(item) ?? '')
  const services: DatadogOverlay['services'] = {}
  for (const service of new Set(join.serviceOfDatadog.values())) {
    const names = [...new Set([...join.serviceOfDatadog].flatMap(([name, mapped]) => (mapped === service ? [name.toLowerCase()] : [])))]
    const signals = names.map((name) => signalsOf(metrics, name, w, names))
    const mine = (svc: string) => join.serviceOfDatadog.get(svc) === service
    const topics = engine.topics.filter((t) => mine(t.svc))
    const signalOf = (svc: string) => signalsOf(metrics, svc, w, names)
    const releases = new Map(engine.releases.filter((r) => mine(r.svc)).map((r) => [r.sha, r]))
    services[service] = {
      state: stateOf(topics, engine.services.some((v) => mine(v.name) && v.measured.length > 0)),
      reasons: topics.flatMap((t) => reasonsOf(t, signalOf(t.svc), w)),
      monitors: snapshot.monitors
        .filter((m) => isProd(m.tags) && mapServiceOf(m) === service)
        .map((m) => ({ id: m.id, name: m.name, status: m.overall_state ?? 'unknown', noisy: noisy.has(m.id), url: `https://app.${site}/monitors/${m.id}` })),
      slos: snapshot.slos.flatMap((slo) =>
        isProd(slo.tags) && mapServiceOf(slo) === service && slo.target !== null
          ? [{ id: slo.id, name: slo.name, target: slo.target, value: slo.value, url: `https://app.${site}/slo?slo_id=${slo.id}` }]
          : [],
      ),
      strip: stripOf(signals, w),
      releases: [...releases.values()].map((r) => ({ sha: r.sha, title: r.v, mergedAt: new Date(r.ts * 1000).toISOString(), verdict: r.verdict })),
      incidents: snapshot.incidents
        .filter((i) => i.services.some((s) => normaliseName(s) === normaliseName(service)))
        .map((i) => ({ id: i.id, title: i.title, severity: i.severity ?? 'unknown', url: `https://app.${site}/incidents/${i.id}` })),
    }
  }
  return { snapshotDate: snapshot.meta.fetchedAt.slice(0, 10), eventsCapped: snapshot.events.capped, services, queues: queuesOf(snapshot, join, to) }
}

export function overlayOf(snapshot: DatadogSnapshot, join: DatadogJoin, repoBase: string, git: GitRunner = defaultGit): DatadogOverlay {
  const now = snapshot.meta.to
  const since = new Date((now - FORTNIGHT) * 1000)
  const releases = [...new Set(join.serviceOfDatadog.values())].flatMap((repo) => {
    try {
      return releasesOf(path.join(repoBase, repo), repo, productionBranch(repo), since, git)
    } catch {
      return []
    }
  })
  const services = new Map([...join.serviceOfDatadog].map(([name, repo]) => [name.toLowerCase(), { name, repo }]))
  const engine = topicsOf({
    now,
    from: snapshot.meta.from,
    metrics: snapshot.metrics,
    services: [...services.values()],
    monitors: snapshot.monitors,
    triggers: snapshot.events.items,
    releases,
  })
  return buildOverlay(snapshot, join, engine, new Date(now * 1000))
}
