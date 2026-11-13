import { z } from 'zod'
import { list, num, obj, present, text } from '../json'
import { mapAtMost } from '../net/at-most'
import { readPages } from '../net/pages'
import { snapshotFolder } from '../snapshot-dir'
import type { JiraClient } from './client'
import { BR_SCOPE, EXCLUDED_RESOLUTIONS, FEATURE_AREA_FIELD, FEATURE_AREA_JQL, openClause, SLA_FIELD } from './fields'

const STATUS_CATEGORIES = ['new', 'indeterminate', 'done', 'undefined'] as const

const BugSchema = z.object({
  key: z.string(),
  created: z.string(),
  status: z.string(),
  statusCategory: z.enum(STATUS_CATEGORIES),
  priority: z.string().nullable(),
  featureArea: z.string().nullable(),
  breached: z.boolean(),
})
const BoardSchema = z.object({ id: z.number(), name: z.string(), type: z.string(), projectKey: z.string().nullable() })

const SnapshotSchema = z.object({
  meta: z.object({ fetchedAt: z.string(), host: z.string(), labelsCapped: z.boolean().optional() }),
  featureAreaLabels: z.array(z.string()),
  statuses: z.array(z.string()),
  boards: z.array(BoardSchema),
  bugs: z.array(BugSchema),
  boardBugs: z.record(z.string(), z.array(z.string())),
})

type JiraBug = z.infer<typeof BugSchema>
type JiraBoard = z.infer<typeof BoardSchema>

export type JiraSnapshot = z.infer<typeof SnapshotSchema>

const RECENT_DAYS = 90
const SEARCH_PAGE = 100
const AGILE_PAGE = 50
const LABEL_PROBES_AT_ONCE = 6
const LABEL_MAX_CALLS = 150
const LABEL_FULL_ANSWER = 15
const LABEL_MAX_PREFIX = 2
const LABEL_CHARS = [...'abcdefghijklmnopqrstuvwxyz0123456789éèàâçîôœ']
const SUGGESTIONS_PATH = '/rest/api/3/jql/autocompletedata/suggestions'
const SEARCH_FIELDS = ['created', 'status', 'priority', 'resolution', FEATURE_AREA_FIELD, SLA_FIELD].join(',')

const isStatusCategory = (v: unknown): v is JiraBug['statusCategory'] => STATUS_CATEGORIES.some((category) => category === v)

const unquoted = (value: string): string => value.replace(/^"(.*)"$/s, (_, inner: string) => inner.replace(/\\(.)/g, '$1'))

async function featureAreaLabels(client: JiraClient): Promise<{ labels: string[]; capped: boolean }> {
  const found = new Set<string>()
  const probe = async (typed: string): Promise<boolean> => {
    const query = { fieldName: FEATURE_AREA_JQL, ...(typed ? { fieldValue: typed } : {}) }
    const values = list(obj(await client.get(SUGGESTIONS_PATH, query)).results)
      .map((r) => text(obj(r).value))
      .filter(present)
      .map(unquoted)
      .filter((v) => v !== '')
    values.forEach((v) => found.add(v))
    return values.length >= LABEL_FULL_ANSWER
  }
  let left = LABEL_MAX_CALLS
  let level = ['']
  let fullAtLastPrefix = false
  while (level.length > 0 && left > 0) {
    const batch = level.slice(0, left)
    left -= batch.length
    const maybeCut = await mapAtMost(batch, LABEL_PROBES_AT_ONCE, probe)
    fullAtLastPrefix ||= batch.some((typed, k) => maybeCut[k] === true && typed.length >= LABEL_MAX_PREFIX)
    level = batch.filter((typed, k) => maybeCut[k] === true && typed.length < LABEL_MAX_PREFIX).flatMap((typed) => LABEL_CHARS.map((c) => typed + c))
  }
  return { labels: [...found].sort(), capped: level.length > 0 || fullAtLastPrefix }
}

const statusNames = (v: unknown): string[] => [...new Set(list(v).map((s) => text(obj(s).name)).filter(present))].sort()

function boardOf(v: unknown): JiraBoard | null {
  const b = obj(v)
  const id = num(b.id)
  return id === null ? null : { id, name: text(b.name) ?? '', type: text(b.type) ?? '', projectKey: text(obj(b.location).projectKey) }
}

const firstValue = (v: unknown): string | null => text(obj(Array.isArray(v) ? v.at(0) : v).value)

function breachedOf(sla: unknown): boolean {
  const s = obj(sla)
  const ongoing = obj(s.ongoingCycle)
  const cycle = Object.keys(ongoing).length > 0 ? ongoing : obj(list(s.completedCycles).at(-1))
  return cycle.breached === true
}

function bugOf(v: unknown): JiraBug | null {
  const issue = obj(v)
  const f = obj(issue.fields)
  const key = text(issue.key)
  const created = text(f.created)
  const status = obj(f.status)
  const statusName = text(status.name)
  if (key === null || created === null || statusName === null || EXCLUDED_RESOLUTIONS.includes(text(obj(f.resolution).name) ?? '')) {
    return null
  }
  const category = obj(status.statusCategory).key
  return {
    key,
    created,
    status: statusName,
    statusCategory: isStatusCategory(category) ? category : 'undefined',
    priority: text(obj(f.priority).name),
    featureArea: firstValue(f[FEATURE_AREA_FIELD]),
    breached: breachedOf(f[SLA_FIELD]),
  }
}

async function bugs(client: JiraClient, jql: string): Promise<JiraBug[]> {
  const pages = await readPages('', async (token) => {
    const r = obj(await client.get('/rest/api/3/search/jql', { jql, fields: SEARCH_FIELDS, maxResults: String(SEARCH_PAGE), ...(token ? { nextPageToken: token } : {}) }))
    const next = text(r.nextPageToken)
    return { items: list(r.issues).map(bugOf).filter(present), next: next && r.isLast !== true ? next : null }
  })
  return pages.items
}

async function boards(client: JiraClient): Promise<JiraBoard[]> {
  const pages = await readPages(0, async (startAt) => {
    const r = obj(await client.get('/rest/agile/1.0/board', { startAt: String(startAt), maxResults: String(AGILE_PAGE) }))
    const items = list(r.values).map(boardOf).filter(present)
    return { items, next: r.isLast === false && items.length > 0 ? startAt + items.length : null }
  })
  return pages.items
}

async function boardBugKeys(client: JiraClient, boardId: number, jql: string): Promise<string[]> {
  const pages = await readPages(0, async (startAt) => {
    const r = obj(await client.get(`/rest/agile/1.0/board/${boardId}/issue`, { jql, fields: 'key', startAt: String(startAt), maxResults: String(AGILE_PAGE) }))
    const keys = list(r.issues).map((i) => text(obj(i).key)).filter(present)
    const total = num(r.total)
    const more = total === null ? r.isLast === false : startAt + keys.length < total
    return { items: keys, next: more && keys.length > 0 ? startAt + keys.length : null }
  })
  return pages.items
}

export async function fetchJiraSnapshot(client: JiraClient, boardIds: number[], now: Date): Promise<JiraSnapshot> {
  await client.get('/rest/api/3/myself')
  const statuses = statusNames(await client.get('/rest/api/3/status'))
  const { labels, capped } = await featureAreaLabels(client)
  const boardList = await boards(client)
  const open = openClause(new Set(statuses))
  const bugList = await bugs(client, `${BR_SCOPE} AND (${open} OR created >= -${RECENT_DAYS}d)`)
  const boardBugs: Record<string, string[]> = {}
  for (const id of boardIds) {
    boardBugs[String(id)] = await boardBugKeys(client, id, `${BR_SCOPE} AND (${open})`)
  }
  return { meta: { fetchedAt: now.toISOString(), host: client.host, labelsCapped: capped }, featureAreaLabels: labels, statuses, boards: boardList, bugs: bugList, boardBugs }
}

const folder = snapshotFolder({ schema: SnapshotSchema, label: 'Jira', fetchScript: 'discover:jira:fetch' })

export const writeJiraSnapshot = (dir: string, s: JiraSnapshot): void => folder.write(dir, s)

export const readJiraSnapshot = (dir: string): JiraSnapshot => folder.read(dir)
