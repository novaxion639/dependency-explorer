import type { JiraOverlay, Team } from '@dependency-explorer/data'

type AreaBugs = JiraOverlay['areas'][string]

export const fixtureTeams: Team[] = [{ id: 'team-anchovy', name: 'Team Anchovy', jiraBoards: [17] }]

export const areaBugs = (over: Partial<AreaBugs> = {}): AreaBugs => ({
  open: 12,
  breached: 3,
  opened90d: 27,
  weekly: [1, 2, 0, 3, 2, 1, 4, 2, 3, 1, 2, 3, 3],
  featureAreas: [
    { name: 'Exports', open: 2, breached: 0, opened90d: 5 },
    { name: 'Rounding', open: 7, breached: 2, opened90d: 15 },
    { name: 'Badges', open: 3, breached: 1, opened90d: 7 },
  ],
  teams: [{ teamId: 'team-anchovy', open: 8 }, { teamId: null, open: 4 }],
  jql: 'project = BR AND cf[11070] in ("Rounding", "Shifts \\"beta\\"")',
  ...over,
})

export const jiraOverlayOf = (over: Partial<JiraOverlay> = {}): JiraOverlay => ({
  snapshotDate: '2026-11-02',
  host: 'skello.atlassian.net',
  areas: {},
  unmapped: { open: 4, breached: 1, jql: 'project = BR AND cf[11070] is EMPTY' },
  boards: { 17: { name: 'Anchovy board' } },
  ...over,
})
