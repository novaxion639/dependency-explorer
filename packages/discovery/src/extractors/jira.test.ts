import { describe, expect, it } from 'vitest'
import { ConnectivityMapSchema } from '@dependency-explorer/schema'
import { findingKeys } from '../baseline'
import { buildJiraOverlay } from '../jira/overlay'
import type { JiraSnapshot } from '../jira/snapshot'
import { jiraSection, joinJira } from './jira'

type Bug = JiraSnapshot['bugs'][number]

const bug = (key: string, featureArea: string | null, parts: Partial<Bug> = {}): Bug => ({
  key, created: '2026-10-20T10:00:00.000+0200', status: 'To Do', statusCategory: 'new', priority: 'Medium', featureArea, breached: false, ...parts,
})

const board = (id: number, name: string) => ({ id, name, type: 'scrum', projectKey: 'DEV' })

function snapshot(parts: Partial<JiraSnapshot>): JiraSnapshot {
  return {
    meta: { fetchedAt: '2026-11-02T08:00:00.000Z', host: 'skello.atlassian.net' },
    featureAreaLabels: ['Shifts', 'Payroll', 'Legacy'],
    statuses: ['To Do', 'In Progress', 'QA', 'Done'],
    boards: [board(10, 'Board Honey'), board(20, 'Team Mozza board')],
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
    { label: 'Payroll', tribe: 'Pay', area: 'payroll-reports' },
    { label: 'Legacy', tribe: null, area: null },
  ],
})

const kinds = (s: JiraSnapshot, kind: string, m = map) => joinJira(s, m).findings.filter(f => f.kind === kind)

describe('joinJira', () => {
  it('attributes a bug to the area of its first label', () => {
    expect(joinJira(snapshot({ bugs: [bug('BR-1', 'Shifts')] }), map).areaOfBug.get('BR-1')).toBe('planning')
  })

  it('counts a null-area label as unmapped', () => {
    const join = joinJira(snapshot({ bugs: [bug('BR-1', 'Legacy'), bug('BR-2', null)] }), map)
    expect(join.areaOfBug.get('BR-1')).toBeNull()
    expect(join.areaOfBug.get('BR-2')).toBeNull()
    expect(join.findings.filter(f => f.kind === 'unmapped-label')).toEqual([])
  })

  it('counts an unknown label as unmapped and reports it', () => {
    const s = snapshot({ featureAreaLabels: ['Shifts', 'Payroll', 'Legacy', 'Badges'], bugs: [bug('BR-1', 'Badges'), bug('BR-2', 'Badges', { statusCategory: 'done', status: 'Done' })] })
    expect(joinJira(s, map).areaOfBug.get('BR-1')).toBeNull()
    expect(kinds(s, 'unmapped-label')).toEqual([
      { kind: 'unmapped-label', label: 'Badges', open: 1, fix: 'Add Badges to packages/data/src/feature-areas.ts with its area (`pnpm discover:jira:draft` drafts the row)' },
    ])
  })

  it('reports a label the map has and Jira no longer has', () => {
    expect(kinds(snapshot({ featureAreaLabels: ['Shifts', 'Legacy'] }), 'gone-label')).toEqual([
      { kind: 'gone-label', label: 'Payroll', fix: 'Remove Payroll from packages/data/src/feature-areas.ts, or restore the option in Jira' },
    ])
  })

  it('reports no gone label when the label walk was cut, and says so', () => {
    const capped = snapshot({ featureAreaLabels: ['Shifts', 'Legacy'], meta: { fetchedAt: '2026-11-02T08:00:00.000Z', host: 'skello.atlassian.net', labelsCapped: true } })
    expect(kinds(capped, 'gone-label')).toEqual([])
    expect(kinds(capped, 'labels-capped')).toEqual([
      { kind: 'labels-capped', fix: 'Raise LABEL_MAX_CALLS in packages/discovery/src/jira/snapshot.ts and fetch again; gone labels are not reported until the list is whole' },
    ])
  })

  it('reports an unknown board id', () => {
    expect(kinds(snapshot({ boards: [board(20, 'Team Mozza board')] }), 'unknown-board')).toEqual([
      { kind: 'unknown-board', teamId: 'team-honey', board: 10, fix: 'Remove board 10 from the jiraBoards of team-honey in packages/data/src/teams.ts' },
    ])
  })

  it('suggests a board whose name contains the team name', () => {
    const s = snapshot({ boards: [board(10, 'Board Honey'), board(20, 'Team Mozza board'), board(109, ' HONEY support ')] })
    expect(kinds(s, 'board-suggestion')).toEqual([
      { kind: 'board-suggestion', teamId: 'team-honey', board: 109, boardName: 'HONEY support', fix: 'Add board 109 (HONEY support) to the jiraBoards of team-honey in packages/data/src/teams.ts' },
    ])
  })

  it('suggests no board for a team named only Team', () => {
    const bare = ConnectivityMapSchema.parse({ ...map, teams: [{ id: 'team', name: 'Team' }] })
    expect(kinds(snapshot({}), 'board-suggestion', bare)).toEqual([])
  })

  it('reports a label seen on BRs but absent from autocomplete', () => {
    const s = snapshot({ featureAreaLabels: ['Shifts', 'Legacy'], bugs: [bug('BR-1', 'Payroll')] })
    expect(kinds(s, 'unlisted-label')).toEqual([
      { kind: 'unlisted-label', label: 'Payroll', fix: 'Re-enable the Payroll option in Jira, or move its BRs to a listed Feature Area' },
    ])
  })

  it('lists the teams whose boards hold a bug', () => {
    const s = snapshot({ bugs: [bug('BR-1', 'Shifts'), bug('BR-2', 'Shifts')], boardBugs: { 10: ['BR-1'], 20: ['BR-1'], 99: ['BR-2'] } })
    const join = joinJira(s, map)
    expect(join.teamsOfBug.get('BR-1')).toEqual(['team-honey', 'team-mozza'])
    expect(join.teamsOfBug.get('BR-2')).toEqual([])
  })

  it('keeps 🎫 findings out of the baseline keys', () => {
    const s = snapshot({ featureAreaLabels: [], bugs: [bug('BR-1', 'Badges')] })
    const join = joinJira(s, map)
    const jira = { join, overlay: buildJiraOverlay(s, join, map, new Date(s.meta.fetchedAt)) }
    expect(join.findings.length).toBeGreaterThan(0)
    expect(findingKeys({ scannedRepos: [], jira })).toEqual(findingKeys({ scannedRepos: [], jira: null }))
  })
})

describe('jiraSection', () => {
  it('discover without --jira prints no 🎫 section', () => {
    expect(jiraSection(null)).toBeNull()
  })

  it('prints one line per finding with its fix', () => {
    const s = snapshot({
      featureAreaLabels: ['Shifts', 'Legacy', 'Badges'],
      boards: [board(20, 'Team Mozza board'), board(109, 'Honey support')],
      bugs: [bug('BR-1', 'Badges'), bug('BR-2', 'Notes')],
    })
    expect(jiraSection(joinJira(s, map))).toBe([
      '\n## 🎫 Jira drift (advisory, not in the baseline)\n',
      '- **Badges** is not in the Feature Area map (1 open BRs) — Add Badges to packages/data/src/feature-areas.ts with its area (`pnpm discover:jira:draft` drafts the row)',
      '- **Notes** is not in the Feature Area map (1 open BRs) — Add Notes to packages/data/src/feature-areas.ts with its area (`pnpm discover:jira:draft` drafts the row)',
      '- **Payroll** is mapped but no longer a Jira Feature Area option — Remove Payroll from packages/data/src/feature-areas.ts, or restore the option in Jira',
      '- **Notes** is on BRs but absent from the Feature Area autocomplete — Re-enable the Notes option in Jira, or move its BRs to a listed Feature Area',
      '- **team-honey** lists board 10, which Jira does not have — Remove board 10 from the jiraBoards of team-honey in packages/data/src/teams.ts',
      '- **team-honey** may own board 109 (Honey support) — Add board 109 (Honey support) to the jiraBoards of team-honey in packages/data/src/teams.ts',
    ].join('\n'))
  })

  it('says when there is no drift', () => {
    expect(jiraSection(joinJira(snapshot({}), map))).toBe('\n## 🎫 Jira drift (advisory, not in the baseline)\n\n_none_')
  })
})
