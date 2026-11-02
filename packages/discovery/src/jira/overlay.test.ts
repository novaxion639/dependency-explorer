import { describe, expect, it } from 'vitest'
import { ConnectivityMapSchema, JiraOverlaySchema } from '@dependency-explorer/schema'
import { joinJira } from '../extractors/jira'
import { BR_SCOPE } from './fields'
import { buildJiraOverlay, jqlOf } from './overlay'
import type { JiraSnapshot } from './snapshot'

type Bug = JiraSnapshot['bugs'][number]

const NOW = new Date('2026-11-04T12:00:00.000Z')
const OPEN = 'statusCategory != Done OR status in ("QA")'

const bug = (key: string, featureArea: string | null, parts: Partial<Bug> = {}): Bug => ({
  key, created: '2026-10-28T10:00:00.000Z', status: 'To Do', statusCategory: 'new', priority: 'Medium', featureArea, breached: false, ...parts,
})
const done = { status: 'Done', statusCategory: 'done' } as const

function snapshot(parts: Partial<JiraSnapshot>): JiraSnapshot {
  return {
    meta: { fetchedAt: '2026-11-04T08:00:00.000Z', host: 'skello.atlassian.net' },
    featureAreaLabels: ['Shifts', 'Breaks', 'Payroll', 'Legacy'],
    statuses: ['To Do', 'QA', 'Done'],
    boards: [{ id: 10, name: ' Board Honey ', type: 'scrum', projectKey: 'DEV' }, { id: 20, name: 'Mozza', type: 'kanban', projectKey: null }],
    bugs: [],
    boardBugs: {},
    ...parts,
  }
}

const map = ConnectivityMapSchema.parse({
  services: [],
  connections: [],
  flows: [],
  teams: [
    { id: 'team-honey', name: 'Team Honey', jiraBoards: [10] },
    { id: 'team-mozza', name: 'Team Mozza', jiraBoards: [20] },
  ],
  featureAreas: [
    { label: 'Shifts', tribe: 'Plan', area: 'planning' },
    { label: 'Breaks', tribe: 'Plan', area: 'planning' },
    { label: 'Payroll', tribe: 'Pay', area: 'payroll-reports' },
    { label: 'Legacy', tribe: null, area: null },
  ],
})

const overlayOf = (s: JiraSnapshot) => buildJiraOverlay(s, joinJira(s, map), map, NOW)

describe('buildJiraOverlay', () => {
  it('counts a QA bug as open and a done bug as not', () => {
    const overlay = overlayOf(snapshot({ bugs: [bug('BR-1', 'Shifts', { status: 'QA', statusCategory: 'done' }), bug('BR-2', 'Shifts', done)] }))
    expect(overlay.areas.planning).toMatchObject({ open: 1, opened90d: 2 })
  })

  it('counts breached only among open bugs', () => {
    const overlay = overlayOf(snapshot({ bugs: [bug('BR-1', 'Shifts', { breached: true }), bug('BR-2', 'Shifts', { ...done, breached: true })] }))
    expect(overlay.areas.planning).toMatchObject({ open: 1, breached: 1 })
  })

  it('counts opened90d by creation within 90 days of now', () => {
    const overlay = overlayOf(snapshot({ bugs: [bug('BR-1', 'Shifts', { created: '2026-08-07T00:00:00.000Z' }), bug('BR-2', 'Shifts', { created: '2026-08-05T00:00:00.000Z' })] }))
    expect(overlay.areas.planning).toMatchObject({ open: 2, opened90d: 1 })
  })

  it('keeps an area with only old done bugs out of areas', () => {
    const overlay = overlayOf(snapshot({ bugs: [bug('BR-1', 'Payroll', { ...done, created: '2026-01-01T00:00:00.000Z' })] }))
    expect(overlay.areas).toEqual({})
  })

  it('rows the feature areas of an area by label, most open first', () => {
    const overlay = overlayOf(snapshot({ bugs: [bug('BR-1', 'Shifts', done), bug('BR-2', 'Breaks'), bug('BR-3', 'Breaks', { breached: true })] }))
    expect(overlay.areas.planning?.featureAreas).toEqual([
      { name: 'Breaks', open: 2, breached: 1, opened90d: 2 },
      { name: 'Shifts', open: 0, breached: 0, opened90d: 1 },
    ])
  })

  it('counts a bug on two boards once in open', () => {
    const s = snapshot({ bugs: [bug('BR-1', 'Shifts'), bug('BR-2', 'Shifts'), bug('BR-3', 'Breaks'), bug('BR-4', 'Shifts', done)], boardBugs: { 10: ['BR-1', 'BR-2'], 20: ['BR-1'] } })
    const planning = overlayOf(s).areas.planning
    expect(planning?.open).toBe(3)
    expect(planning?.teams).toEqual([
      { teamId: 'team-honey', open: 2 },
      { teamId: 'team-mozza', open: 1 },
      { teamId: null, open: 1 },
    ])
  })

  it('buckets 13 ISO weeks oldest first', () => {
    const bugs = [
      bug('BR-1', 'Shifts', { created: '2026-11-02T00:00:00.000Z' }),
      bug('BR-2', 'Shifts', { created: '2026-11-01T23:59:59.000Z' }),
      bug('BR-3', 'Shifts', { created: '2026-08-10T00:00:00.000Z' }),
      bug('BR-4', 'Shifts', { created: '2026-08-09T23:59:59.000Z' }),
      bug('BR-5', 'Shifts', { created: '2026-11-04T11:00:00.000Z' }),
    ]
    expect(overlayOf(snapshot({ bugs })).areas.planning?.weekly).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2])
  })

  it('links each area to its open BRs by label', () => {
    expect(overlayOf(snapshot({ bugs: [bug('BR-1', 'Payroll')] })).areas['payroll-reports']?.jql).toBe(`${BR_SCOPE} AND (${OPEN}) AND cf[11070] in ("Payroll")`)
  })

  it('counts unlabelled, unknown and null-area open bugs as unmapped', () => {
    const s = snapshot({ bugs: [bug('BR-1', null, { breached: true }), bug('BR-2', 'Legacy'), bug('BR-3', 'Badges'), bug('BR-4', 'Badges', done), bug('BR-5', 'Shifts')] })
    expect(overlayOf(s).unmapped).toEqual({
      open: 3,
      breached: 1,
      jql: `${BR_SCOPE} AND (${OPEN}) AND (cf[11070] is EMPTY OR cf[11070] in ("Badges", "Legacy"))`,
    })
  })

  it('queries only empty labels when every unmapped bug is unlabelled', () => {
    expect(overlayOf(snapshot({ bugs: [bug('BR-1', null)] })).unmapped.jql).toBe(`${BR_SCOPE} AND (${OPEN}) AND cf[11070] is EMPTY`)
  })

  it('names every board and dates the snapshot', () => {
    const overlay = overlayOf(snapshot({}))
    expect(overlay).toMatchObject({ snapshotDate: '2026-11-04', host: 'skello.atlassian.net', boards: { 10: { name: 'Board Honey' }, 20: { name: 'Mozza' } } })
    expect(JiraOverlaySchema.safeParse(overlay).success).toBe(true)
  })

  it('builds an empty overlay from a map without feature areas', () => {
    const bare = ConnectivityMapSchema.parse({ services: [], connections: [], flows: [] })
    const s = snapshot({ bugs: [bug('BR-1', 'Shifts')] })
    expect(buildJiraOverlay(s, joinJira(s, bare), bare, NOW)).toMatchObject({ areas: {}, unmapped: { open: 1 } })
  })

  it('writes no bug key in the overlay', () => {
    const bugs = [bug('BR-101', 'Shifts'), bug('BR-102', null), bug('BR-103', 'Badges'), bug('BR-104', 'Payroll', done)]
    const text = JSON.stringify(overlayOf(snapshot({ bugs, boardBugs: { 10: ['BR-101'], 20: ['BR-102'] } })))
    expect(bugs.filter(b => text.includes(b.key))).toEqual([])
  })
})

describe('jqlOf', () => {
  it('escapes quotes and backslashes in the JQL', () => {
    expect(jqlOf(['Shifts "beta"', 'a\\b'], OPEN)).toBe(`${BR_SCOPE} AND (${OPEN}) AND cf[11070] in ("Shifts \\"beta\\"", "a\\\\b")`)
  })
})
