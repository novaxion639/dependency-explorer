import * as fs from 'node:fs'
import * as path from 'node:path'
import type { DatadogOverlay } from '@dependency-explorer/schema'
import type { DatadogJoin } from '../extractors/datadog'
import { defaultGit, errorText, productionBranch, type GitRunner } from '../pinned'
import { noisyMonitors, rise, type Day, type EngineInput } from './health/rules'
import { DAY, RECENT, at, keyedOf, middle, ms, signalsOf, span, tenth, total, windowOf, type Signals, type Window } from './health/series'
import { topicsOf } from './health/topics'
import { releasesOf } from './releases'
import { isProd, METRIC_KEYS, normaliseName, rawServiceOf, rawTagValues, type MetricKey } from './scope'
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

function reasonsOf(t: Topic, s: Signals, w: Window, rawQueues: Map<string, string>): string[] {
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
      return [`DLQ ${rawQueues.get(t.queue) ?? t.queue} above 0 for 72 h, ${t.count} now`]
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

function stripOf(s: Signals, w: Window): ServiceOverlay['strip'] {
  const ofDay = (xs: Hourly, d: number) => span(xs, at(w, d), at(w, d) + 24)
  return w.shown.map((d) => ({
    day: dateOf(d),
    requests: summed(ofDay(s.count, d)),
    errors5xx: summed(ofDay(s.e5, d)),
    p95ms: ms(middle(ofDay(s.p95, d))),
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
    const seen = out[id]
    out[id] = seen === undefined ? { depthNow, depthMax14d } : { depthNow: Math.max(seen.depthNow, depthNow), depthMax14d: Math.max(seen.depthMax14d, depthMax14d) }
  }
  return out
}

type Series = NonNullable<DatadogSnapshot['metrics'][MetricKey]>[number]
type Combine = (a: number, b: number) => number

const LEVELS: MetricKey[] = ['api_p95', 'apm_p95', 'dlq']

function merged(series: Series[], combine: Combine): Series[] {
  const byTags = new Map<string, Series>()
  for (const s of series) {
    const key = s.tag_set.join('\n')
    const prev = byTags.get(key)
    if (prev === undefined) {
      byTags.set(key, s)
      continue
    }
    const points = new Map(prev.pointlist)
    for (const [t, v] of s.pointlist) {
      const p = points.get(t) ?? null
      points.set(t, p === null ? v : v === null ? p : combine(p, v))
    }
    byTags.set(key, { tag_set: prev.tag_set, pointlist: [...points].sort((a, b) => a[0] - b[0]) })
  }
  return [...byTags.values()]
}

function folded(metrics: DatadogSnapshot['metrics'], join: DatadogJoin): { metrics: DatadogSnapshot['metrics']; rawQueues: Map<string, string> } {
  const mapService = new Map([...join.serviceOfDatadog].map(([name, service]) => [name.toLowerCase(), service]))
  const spellings = [...mapService.keys()].sort((a, b) => b.length - a.length)
  const rawQueues = new Map<string, string>()
  const prefixed = (value: string) => {
    const spelling = spellings.find((s) => value.toLowerCase().startsWith(`${s}-`))
    return spelling === undefined ? value : `${mapService.get(spelling)}-${value.slice(spelling.length + 1)}`
  }
  const fold = (tag: string): string => {
    const [key, value] = [tag.slice(0, tag.indexOf(':')), tag.slice(tag.indexOf(':') + 1)]
    const service = mapService.get(value.toLowerCase().replace(/-prod$/, ''))
    if ((key === 'service' || key === 'name') && service !== undefined) {
      return key === 'name' ? `name:${service}-prod` : `service:${service}`
    }
    if (key === 'queuename') {
      rawQueues.set(prefixed(value).toLowerCase(), value)
    }
    return key === 'queuename' || key === 'functionname' ? `${key}:${prefixed(value)}` : tag
  }
  const out = { ...metrics }
  for (const key of METRIC_KEYS) {
    const series = metrics[key]?.map((s) => ({ ...s, tag_set: s.tag_set.map(fold) }))
    out[key] = series === undefined ? null : merged(series, LEVELS.includes(key) ? Math.max : (a, b) => a + b)
  }
  return { metrics: out, rawQueues }
}

const mapServicesOf = (join: DatadogJoin) => [...new Set(join.serviceOfDatadog.values())]

export function healthOf(snapshot: DatadogSnapshot, join: DatadogJoin, releases: EngineInput['releases']): Engine {
  const monitors = snapshot.monitors.map((m) => {
    const service = join.serviceOfDatadog.get(rawServiceOf(m) ?? '')
    return service === undefined ? m : { ...m, tags: [`service:${service}`, ...m.tags] }
  })
  return topicsOf({
    now: snapshot.meta.to,
    from: snapshot.meta.from,
    metrics: folded(snapshot.metrics, join).metrics,
    services: mapServicesOf(join).map((service) => ({ name: service, repo: service })),
    monitors,
    triggers: snapshot.events.items,
    releases,
  })
}

export function buildOverlay(snapshot: DatadogSnapshot, join: DatadogJoin, engine: Engine, now: Date, titles = new Map<string, string>()): DatadogOverlay {
  const to = Math.floor(now.getTime() / 1000)
  const w = windowOf(snapshot.meta.from, to)
  const fold = folded(snapshot.metrics, join)
  const metrics = keyedOf(fold.metrics)
  const site = snapshot.meta.site
  const noisy = noisyMonitors(snapshot.events.items, to)
  const mapServices = mapServicesOf(join)
  const mapServiceOf = (item: { tags: string[]; name: string }) => join.serviceOfDatadog.get(rawServiceOf(item) ?? '')
  const services: DatadogOverlay['services'] = {}
  for (const service of mapServices) {
    const signals = signalsOf(metrics, service, w, mapServices)
    const topics = engine.topics.filter((t) => t.svc === service)
    services[service] = {
      state: stateOf(topics, engine.services.some((v) => v.name === service && v.measured.length > 0)),
      reasons: topics.flatMap((t) => reasonsOf(t, signals, w, fold.rawQueues)),
      monitors: snapshot.monitors
        .filter((m) => isProd(m.tags) && mapServiceOf(m) === service)
        .map((m) => ({ id: m.id, name: m.name, status: m.overall_state ?? 'unknown', noisy: noisy.has(m.id), url: `https://app.${site}/monitors/${m.id}` })),
      slos: snapshot.slos.flatMap((slo) =>
        isProd(slo.tags) && mapServiceOf(slo) === service && slo.target !== null
          ? [{ id: slo.id, name: slo.name, target: slo.target, value: slo.value, url: `https://app.${site}/slo?slo_id=${slo.id}` }]
          : [],
      ),
      strip: stripOf(signals, w),
      releases: engine.releases
        .filter((r) => r.svc === service)
        .map((r) => ({ sha: r.sha, title: titles.get(r.sha) ?? r.v, mergedAt: new Date(r.ts * 1000).toISOString(), verdict: r.verdict })),
      incidents: snapshot.incidents
        .filter((i) => i.services.some((s) => normaliseName(s) === normaliseName(service)))
        .map((i) => ({ id: i.id, title: i.title, severity: i.severity ?? 'unknown', url: `https://app.${site}/incidents/${i.public_id ?? i.id}` })),
    }
  }
  return { snapshotDate: snapshot.meta.fetchedAt.slice(0, 10), eventsCapped: snapshot.events.capped, services, queues: queuesOf(snapshot, join, to) }
}

export function overlayOf(snapshot: DatadogSnapshot, join: DatadogJoin, repoBase: string, pinned: boolean, git: GitRunner = defaultGit): DatadogOverlay {
  const since = new Date((snapshot.meta.to - FORTNIGHT) * 1000)
  const releases = mapServicesOf(join).flatMap((repo) => {
    const repoDir = path.join(repoBase, repo)
    if (!fs.existsSync(repoDir)) {
      console.error(`  releases of ${repo} skipped: no checkout`)
      return []
    }
    try {
      return releasesOf(repoDir, repo, pinned ? 'HEAD' : `origin/${productionBranch(repo)}`, since, git)
    } catch (e) {
      console.error(`  releases of ${repo} skipped: ${errorText(e)}`)
      return []
    }
  })
  const titles = new Map(releases.map((r) => [r.sha, r.title]))
  return buildOverlay(snapshot, join, healthOf(snapshot, join, releases), new Date(snapshot.meta.to * 1000), titles)
}
