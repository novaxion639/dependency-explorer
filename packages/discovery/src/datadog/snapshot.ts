import * as fs from 'node:fs'
import * as path from 'node:path'
import { z } from 'zod'
import { readPages } from '../net/pages'
import type { DatadogClient } from './client'
import { isProd, METRIC_KEYS, metricQueries, serviceOf, tagValues, type MetricKey } from './scope'

const MonitorSchema = z.object({ id: z.number(), name: z.string(), tags: z.array(z.string()), overall_state: z.string().nullable() })
const TeamSchema = z.object({ id: z.string(), handle: z.string(), name: z.string() })
const SloSchema = z.object({ id: z.string(), name: z.string(), tags: z.array(z.string()), target: z.number().nullable(), value: z.number().nullable() })
const IncidentSchema = z.object({
  id: z.string(),
  public_id: z.number().nullable(),
  title: z.string(),
  severity: z.string().nullable(),
  created: z.string().nullable(),
  services: z.array(z.string()),
})
const SeriesSchema = z.object({ tag_set: z.array(z.string()), pointlist: z.array(z.tuple([z.number(), z.number().nullable()])) })
const TransitionSchema = z.object({ monitor_id: z.number(), ts: z.number(), status: z.string().nullable() })

const SnapshotSchema = z.object({
  meta: z.object({ fetchedAt: z.string(), site: z.string(), from: z.number(), to: z.number() }),
  monitors: z.array(MonitorSchema),
  teams: z.array(TeamSchema),
  slos: z.array(SloSchema),
  incidents: z.array(IncidentSchema),
  metrics: z.record(z.enum(METRIC_KEYS), z.array(SeriesSchema).nullable()),
  events: z.object({ items: z.array(TransitionSchema), capped: z.boolean() }),
})

type Monitor = z.infer<typeof MonitorSchema>
type Slo = z.infer<typeof SloSchema>
type Series = z.infer<typeof SeriesSchema>
type MonitorTransition = z.infer<typeof TransitionSchema>

export type DatadogSnapshot = z.infer<typeof SnapshotSchema>

type Json = Record<string, unknown>

const HOUR_S = 3600
const DAY_S = 86_400
const METRIC_DAYS = 21
const APM_DAYS = 14
const EVENT_DAYS = 7
const PAGE_SIZE = 100
const EVENT_PAGE = 500
const MAX_EVENT_PAGES = 4
const CLOSED_INCIDENT_STATES = ['resolved', 'stable']
const UNSCOPED_METRICS: MetricKey[] = ['dlq']

const isJson = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const obj = (v: unknown): Json => (isJson(v) ? v : {})
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const text = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null)
const strings = (v: unknown): string[] => list(v).filter((x): x is string => typeof x === 'string')

function monitorOf(v: unknown): Monitor | null {
  const m = obj(v)
  const id = num(m.id)
  return id === null ? null : { id, name: text(m.name) ?? '', tags: strings(m.tags), overall_state: text(m.status) }
}

function teamOf(v: unknown): DatadogSnapshot['teams'][number] {
  const t = obj(v)
  const a = obj(t.attributes)
  return { id: text(t.id) ?? '', handle: text(a.handle) ?? '', name: text(a.name) ?? '' }
}

function sloOf(v: unknown): Slo {
  const d = obj(obj(v).data)
  const a = obj(d.attributes)
  return {
    id: text(d.id) ?? '',
    name: text(a.name) ?? '',
    tags: strings(a.all_tags ?? a.tags),
    target: num(obj(list(a.thresholds).at(0)).target),
    value: num(obj(list(a.overall_status).at(0)).status),
  }
}

function incidentOf(v: unknown): DatadogSnapshot['incidents'][number] | null {
  const i = obj(v)
  const a = obj(i.attributes)
  const state = text(a.state)
  if (state === null || CLOSED_INCIDENT_STATES.includes(state)) {
    return null
  }
  const services = strings(obj(obj(a.fields).services).value)
  return { id: text(i.id) ?? '', public_id: num(a.public_id), title: text(a.title) ?? '', severity: text(a.severity), created: text(a.created), services }
}

function pointOf(v: unknown): [number, number | null] | null {
  const [t, y] = list(v)
  return typeof t === 'number' && (typeof y === 'number' || y === null) ? [t, y] : null
}

const seriesOf = (r: Json): Series[] =>
  list(r.series).map((s) => ({
    tag_set: strings(obj(s).tag_set),
    pointlist: list(obj(s).pointlist).map(pointOf).filter((p) => p !== null),
  }))

function transitionOf(v: unknown): MonitorTransition | null {
  const a = obj(obj(obj(v).attributes).attributes)
  const id = num(a.monitor_id)
  const ms = num(a.timestamp)
  return id === null || ms === null ? null : { monitor_id: id, ts: Math.floor(ms / 1000), status: text(a.status) }
}

const present = <T>(v: T | null): v is T => v !== null

const sortedUnique = (values: string[]): string[] => [...new Set(values)].sort()

const prodServices = (monitors: Monitor[], slos: Slo[]): string[] =>
  sortedUnique([...monitors, ...slos].filter((m) => isProd(m.tags)).map(serviceOf).filter(present))

const prodTeams = (monitors: Monitor[]): string[] => sortedUnique(monitors.filter((m) => isProd(m.tags)).flatMap((m) => tagValues(m.tags, 'team')))

type MetricFailure = { key: MetricKey; cause: string }

const causeOf = (e: unknown): string => (e instanceof Error ? e.message : String(e))

async function metrics(
  client: DatadogClient,
  services: string[],
  from: number,
  to: number,
): Promise<{ series: Record<MetricKey, Series[] | null>; failures: MetricFailure[] }> {
  const queries = metricQueries(services)
  const out: Record<MetricKey, Series[] | null> = {
    api_count: null,
    api_5xx: null,
    api_4xx: null,
    api_p95: null,
    lambda_errors: null,
    fn_invocations: null,
    fn_errors: null,
    apm_hits: null,
    apm_p95: null,
    apm_status: null,
    dlq: null,
  }
  const failures: MetricFailure[] = []
  const read = services.length > 0 ? METRIC_KEYS : UNSCOPED_METRICS
  for (const key of read) {
    const start = key.startsWith('apm_') ? to - APM_DAYS * DAY_S : from
    try {
      const r = obj(await client.get('/api/v1/query', { from: String(start), to: String(to), query: queries[key] }))
      if (r.status === 'ok') {
        out[key] = seriesOf(r)
      } else {
        failures.push({ key, cause: text(r.error) ?? 'query refused' })
      }
    } catch (e) {
      failures.push({ key, cause: causeOf(e) })
    }
  }
  return { series: out, failures }
}

async function events(client: DatadogClient, teams: string[], services: string[], now: Date): Promise<DatadogSnapshot['events']> {
  const named = services.join(' OR ')
  const parts = [...(teams.length ? [`team:(${teams.join(' OR ')})`] : []), ...(services.length ? [`service:(${named})`, `project:(${named})`] : [])]
  if (parts.length === 0) {
    return { items: [], capped: false }
  }
  const query = `status:(error OR warn) (env:prod OR environment:prod) (${parts.join(' OR ')})`
  const filter = { query, from: new Date(now.getTime() - EVENT_DAYS * DAY_S * 1000).toISOString(), to: now.toISOString() }
  const pages = await readPages<string, MonitorTransition>(
    '',
    async (cursor) => {
      const page = { limit: EVENT_PAGE, ...(cursor ? { cursor } : {}) }
      const r = obj(await client.post('/api/v2/events/search', { filter, page, sort: '-timestamp' }))
      return { items: list(r.data).map(transitionOf).filter(present), next: text(obj(obj(r.meta).page).after) || null }
    },
    MAX_EVENT_PAGES,
  )
  return { items: pages.items, capped: pages.unread }
}

export async function fetchDatadogSnapshot(client: DatadogClient, now: Date): Promise<{ snapshot: DatadogSnapshot; failures: MetricFailure[] }> {
  await client.get('/api/v1/validate')
  const monitors = await readPages(0, async (page) => {
    const r = obj(await client.get('/api/v1/monitor/search', { per_page: String(PAGE_SIZE), page: String(page) }))
    const count = num(obj(r.metadata).page_count) ?? 0
    return { items: list(r.monitors).map(monitorOf).filter(present), next: page + 1 < count ? page + 1 : null }
  })
  const teams = await readPages(0, async (page) => {
    const r = obj(await client.get('/api/v2/team', { 'page[size]': String(PAGE_SIZE), 'page[number]': String(page) }))
    const next = num(obj(obj(r.meta).pagination).next_number)
    return { items: list(r.data).map(teamOf), next: next !== null && next > page ? next : null }
  })
  const slos = await readPages(0, async (page) => {
    const r = obj(await client.get('/api/v1/slo/search', { 'page[size]': String(PAGE_SIZE), 'page[number]': String(page) }))
    const items = list(obj(obj(r.data).attributes).slos)
    return { items: items.map(sloOf), next: items.length < PAGE_SIZE ? null : page + 1 }
  })
  const incidents = await readPages(0, async (offset) => {
    const r = obj(await client.get('/api/v2/incidents', { 'page[size]': String(PAGE_SIZE), 'page[offset]': String(offset) }))
    const data = list(r.data)
    return { items: data.map(incidentOf).filter(present), next: data.length < PAGE_SIZE ? null : offset + PAGE_SIZE }
  })
  const services = prodServices(monitors.items, slos.items)
  const to = Math.trunc(now.getTime() / 1000 / HOUR_S) * HOUR_S
  const from = to - METRIC_DAYS * DAY_S
  const read = await metrics(client, services, from, to)
  const snapshot: DatadogSnapshot = {
    meta: { fetchedAt: now.toISOString(), site: client.site, from, to },
    monitors: monitors.items,
    teams: teams.items,
    slos: slos.items,
    incidents: incidents.items,
    metrics: read.series,
    events: await events(client, prodTeams(monitors.items), services, now),
  }
  return { snapshot, failures: read.failures }
}

const SNAPSHOT_KEYS = ['meta', 'monitors', 'teams', 'slos', 'incidents', 'metrics', 'events'] as const
const SNAPSHOT_FILES = new Set(SNAPSHOT_KEYS.map((key) => `${key}.json`))

const holdsOnlySnapshotFiles = (dir: string): boolean =>
  fs.readdirSync(dir, { withFileTypes: true }).every((entry) => entry.isFile() && SNAPSHOT_FILES.has(entry.name))

export function writeDatadogSnapshot(dir: string, s: DatadogSnapshot): void {
  if (fs.existsSync(dir) && !holdsOnlySnapshotFiles(dir)) {
    throw new Error(`${dir} holds files other than a Datadog snapshot; nothing written`)
  }
  const parent = path.dirname(dir)
  fs.mkdirSync(parent, { recursive: true })
  const temp = fs.mkdtempSync(path.join(parent, `.${path.basename(dir)}-`))
  try {
    for (const key of SNAPSHOT_KEYS) {
      fs.writeFileSync(path.join(temp, `${key}.json`), JSON.stringify(s[key], null, 1))
    }
    fs.rmSync(dir, { recursive: true, force: true })
    fs.renameSync(temp, dir)
  } catch (e) {
    fs.rmSync(temp, { recursive: true, force: true })
    throw e
  }
}

export function readDatadogSnapshot(dir: string): DatadogSnapshot {
  const files = Object.fromEntries(SNAPSHOT_KEYS.map((key) => [key, JSON.parse(fs.readFileSync(path.join(dir, `${key}.json`), 'utf8'))]))
  const parsed = SnapshotSchema.safeParse(files)
  if (!parsed.success) {
    const file = path.join(dir, `${String(parsed.error.issues[0]?.path[0])}.json`)
    throw new Error(`${file} does not match the Datadog snapshot format: ${z.prettifyError(parsed.error)}\nRe-run \`pnpm discover:datadog:fetch\` for a fresh snapshot.`)
  }
  return parsed.data
}
