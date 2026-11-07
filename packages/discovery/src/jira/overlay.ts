import type { ConnectivityMap, JiraOverlay } from '@dependency-explorer/schema'
import type { JiraJoin } from '../extractors/jira'
import { BR_SCOPE, FEATURE_AREA_JQL, isOpenBug, openClause } from './fields'
import type { JiraSnapshot } from './snapshot'

type Bug = JiraSnapshot['bugs'][number]
type TeamRow = JiraOverlay['areas'][string]['teams'][number]
type FeatureAreaRow = JiraOverlay['areas'][string]['featureAreas'][number]

const DAY = 24 * 3600 * 1000
const WEEK = 7 * DAY
const WEEKS = 13
const RECENT = 90 * DAY

const quoted = (label: string): string => `"${label.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
const labelsIn = (labels: string[]): string => `${FEATURE_AREA_JQL} in (${labels.map(quoted).join(', ')})`

export const jqlOf = (labels: string[], open: string): string => `${BR_SCOPE} AND (${open}) AND ${labelsIn(labels)}`

const compare = (a: string, b: string): number => Number(a > b) - Number(a < b)

const byOpenThenTeam = (a: TeamRow, b: TeamRow): number =>
  b.open - a.open || (a.teamId === null ? 1 : b.teamId === null ? -1 : compare(a.teamId, b.teamId))

const byOpenThenName = (a: FeatureAreaRow, b: FeatureAreaRow): number => b.open - a.open || compare(a.name, b.name)

function isoWeekStart(now: Date): number {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return midnight - ((now.getUTCDay() + 6) % 7) * DAY
}

export function buildJiraOverlay(snapshot: JiraSnapshot, join: JiraJoin, map: ConnectivityMap, now: Date): JiraOverlay {
  const siteStatuses = new Set(snapshot.statuses)
  const open = openClause(siteStatuses)
  const isOpen = (b: Bug) => isOpenBug(b, siteStatuses)
  const isRecent = (b: Bug) => now.getTime() - Date.parse(b.created) <= RECENT
  const counts = (bugs: Bug[]) => {
    const openBugs = bugs.filter(isOpen)
    return { open: openBugs.length, breached: openBugs.filter(b => b.breached).length, opened90d: bugs.filter(isRecent).length }
  }
  const firstWeek = isoWeekStart(now) - (WEEKS - 1) * WEEK
  const weekly = (bugs: Bug[]): number[] => {
    const weeks = bugs.map(b => Math.floor((Date.parse(b.created) - firstWeek) / WEEK))
    return Array.from({ length: WEEKS }, (_, week) => weeks.filter(w => w === week).length)
  }
  const teamsOf = (bugs: Bug[]): TeamRow[] => {
    const openOf = new Map<string | null, number>()
    for (const b of bugs.filter(isOpen)) {
      const teams = join.teamsOfBug.get(b.key) ?? []
      for (const teamId of teams.length > 0 ? teams : [null]) {
        openOf.set(teamId, (openOf.get(teamId) ?? 0) + 1)
      }
    }
    return [...openOf].map(([teamId, n]) => ({ teamId, open: n })).sort(byOpenThenTeam)
  }

  const labelsOf = new Map<string, string[]>()
  for (const f of map.featureAreas ?? []) {
    if (f.area !== null) {
      labelsOf.set(f.area, [...(labelsOf.get(f.area) ?? []), f.label])
    }
  }
  const areas: JiraOverlay['areas'] = {}
  for (const [area, labels] of labelsOf) {
    const bugs = snapshot.bugs.filter(b => join.areaOfBug.get(b.key) === area)
    const total = counts(bugs)
    if (total.open === 0 && total.opened90d === 0) {
      continue
    }
    const featureAreas = labels
      .map(name => ({ name, ...counts(bugs.filter(b => b.featureArea === name)) }))
      .filter(row => row.open > 0 || row.opened90d > 0)
      .sort(byOpenThenName)
    areas[area] = { ...total, weekly: weekly(bugs), featureAreas, teams: teamsOf(bugs), jql: jqlOf(labels, open) }
  }

  const unmapped = snapshot.bugs.filter(b => isOpen(b) && (join.areaOfBug.get(b.key) ?? null) === null)
  const areaOfLabel = new Map((map.featureAreas ?? []).map(f => [f.label, f.area]))
  const knownLabels = [...snapshot.featureAreaLabels, ...snapshot.bugs.flatMap(b => b.featureArea ?? [])]
  const unmappedLabels = [...new Set(knownLabels.filter(label => (areaOfLabel.get(label) ?? null) === null))].sort()
  const empty = `${FEATURE_AREA_JQL} is EMPTY`
  return {
    snapshotDate: snapshot.meta.fetchedAt.slice(0, 10),
    host: snapshot.meta.host,
    areas,
    unmapped: {
      open: unmapped.length,
      breached: unmapped.filter(b => b.breached).length,
      jql: `${BR_SCOPE} AND (${open}) AND ${unmappedLabels.length > 0 ? `(${empty} OR ${labelsIn(unmappedLabels)})` : empty}`,
    },
    boards: Object.fromEntries(snapshot.boards.map(b => [String(b.id), { name: b.name.trim() }])),
  }
}
