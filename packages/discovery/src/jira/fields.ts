export const FEATURE_AREA_FIELD = 'customfield_11070'
export const FEATURE_AREA_JQL = 'cf[11070]'
export const SLA_FIELD = 'customfield_10632'
export const BR_SCOPE = 'project = BR AND issuetype = Bug AND status != Deleted'

const TO_SHIP = ['QA', 'Go for MEP']

export const EXCLUDED_RESOLUTIONS = ['Not a bug', "Won't Do", "Won't do", 'Duplicate', 'Cannot Reproduce']

export function openClause(siteStatuses: Set<string>): string {
  const toShip = TO_SHIP.filter((name) => siteStatuses.has(name)).map((name) => JSON.stringify(name))
  return `statusCategory != Done${toShip.length > 0 ? ` OR status in (${toShip.join(', ')})` : ''}`
}

export function isOpenBug(bug: { status: string; statusCategory: string }, siteStatuses: Iterable<string>): boolean {
  return bug.statusCategory !== 'done' || (TO_SHIP.includes(bug.status) && new Set(siteStatuses).has(bug.status))
}
