import type { ConnectivityMap } from '@dependency-explorer/schema'
import { isOpenBug } from '../jira/fields'
import type { JiraSnapshot } from '../jira/snapshot'

type JiraFinding =
  | { kind: 'unmapped-label'; label: string; open: number; fix: string }
  | { kind: 'gone-label'; label: string; fix: string }
  | { kind: 'unknown-board'; teamId: string; board: number; fix: string }
  | { kind: 'board-suggestion'; teamId: string; board: number; boardName: string; fix: string }
  | { kind: 'unlisted-label'; label: string; fix: string }
  | { kind: 'labels-capped'; fix: string }

export interface JiraJoin {
  areaOfBug: Map<string, string | null>
  teamsOfBug: Map<string, string[]>
  findings: JiraFinding[]
}

const FEATURE_AREAS_FILE = 'packages/data/src/feature-areas.ts'
const TEAMS_FILE = 'packages/data/src/teams.ts'

const sortedUnique = (values: string[]): string[] => [...new Set(values)].sort()

function labelFindings(snapshot: JiraSnapshot, map: ConnectivityMap): JiraFinding[] {
  const mapped = new Set((map.featureAreas ?? []).map(f => f.label))
  const listed = new Set(snapshot.featureAreaLabels)
  const siteStatuses = new Set(snapshot.statuses)
  const onBugs = sortedUnique(snapshot.bugs.flatMap(b => b.featureArea ?? []))
  const openOf = (label: string) => snapshot.bugs.filter(b => b.featureArea === label && isOpenBug(b, siteStatuses)).length
  return [
    ...sortedUnique([...listed, ...onBugs]).filter(label => !mapped.has(label)).map((label): JiraFinding => ({
      kind: 'unmapped-label', label, open: openOf(label), fix: `Add ${label} to ${FEATURE_AREAS_FILE} with its area (\`pnpm discover:jira:draft\` drafts the row)`,
    })),
    ...(snapshot.meta.labelsCapped
      ? [{ kind: 'labels-capped', fix: 'Raise LABEL_MAX_CALLS in packages/discovery/src/jira/snapshot.ts and fetch again; gone labels are not reported until the list is whole' } satisfies JiraFinding]
      : [...mapped].filter(label => !listed.has(label)).sort().map((label): JiraFinding => ({
        kind: 'gone-label', label, fix: `Remove ${label} from ${FEATURE_AREAS_FILE}, or restore the option in Jira`,
      }))),
    ...onBugs.filter(label => !listed.has(label)).map((label): JiraFinding => ({
      kind: 'unlisted-label', label, fix: `Re-enable the ${label} option in Jira, or move its BRs to a listed Feature Area`,
    })),
  ]
}

function boardFindings(snapshot: JiraSnapshot, map: ConnectivityMap): JiraFinding[] {
  const known = new Set(snapshot.boards.map(b => b.id))
  return (map.teams ?? []).flatMap((team): JiraFinding[] => {
    const listed = team.jiraBoards ?? []
    const word = team.name.replace(/\bteam\b/gi, '').trim().toLowerCase()
    const suggested = word === '' ? [] : snapshot.boards.filter(b => b.name.toLowerCase().includes(word) && !listed.includes(b.id))
    return [
      ...listed.filter(id => !known.has(id)).map((board): JiraFinding => ({
        kind: 'unknown-board', teamId: team.id, board, fix: `Remove board ${board} from the jiraBoards of ${team.id} in ${TEAMS_FILE}`,
      })),
      ...suggested.map((b): JiraFinding => {
        const boardName = b.name.trim()
        return { kind: 'board-suggestion', teamId: team.id, board: b.id, boardName, fix: `Add board ${b.id} (${boardName}) to the jiraBoards of ${team.id} in ${TEAMS_FILE}` }
      }),
    ]
  })
}

export function joinJira(snapshot: JiraSnapshot, map: ConnectivityMap): JiraJoin {
  const areaOfLabel = new Map((map.featureAreas ?? []).map(f => [f.label, f.area]))
  const teamsOfBug = new Map(snapshot.bugs.map(b => [b.key, new Set<string>()]))
  for (const team of map.teams ?? []) {
    for (const key of (team.jiraBoards ?? []).flatMap(id => snapshot.boardBugs[String(id)] ?? [])) {
      teamsOfBug.get(key)?.add(team.id)
    }
  }
  return {
    areaOfBug: new Map(snapshot.bugs.map(b => [b.key, areaOfLabel.get(b.featureArea ?? '') ?? null])),
    teamsOfBug: new Map([...teamsOfBug].map(([key, teams]) => [key, [...teams].sort()])),
    findings: [...labelFindings(snapshot, map), ...boardFindings(snapshot, map)],
  }
}

function findingLine(f: JiraFinding): string {
  switch (f.kind) {
    case 'unmapped-label':
      return `**${f.label}** is not in the Feature Area map (${f.open} open BRs)`
    case 'gone-label':
      return `**${f.label}** is mapped but no longer a Jira Feature Area option`
    case 'unknown-board':
      return `**${f.teamId}** lists board ${f.board}, which Jira does not have`
    case 'board-suggestion':
      return `**${f.teamId}** may own board ${f.board} (${f.boardName})`
    case 'unlisted-label':
      return `**${f.label}** is on BRs but absent from the Feature Area autocomplete`
    case 'labels-capped':
      return 'The Feature Area list was cut short by its call budget'
  }
}

export function jiraSection(join: JiraJoin | null): string | null {
  if (!join) {
    return null
  }
  const lines = join.findings.map(f => `- ${findingLine(f)} — ${f.fix}`)
  return ['\n## 🎫 Jira drift (advisory, not in the baseline)\n', ...(lines.length ? lines : ['_none_'])].join('\n')
}
