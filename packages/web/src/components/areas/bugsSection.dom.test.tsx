// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { allByRole, byRole, byText } from '../../test/roles'
import { BugsSection } from './BugsSection'
import { areaBugs, fixtureTeams } from './jiraOverlayFixture'

const NOW = new Date('2026-11-02T12:00:00Z')
const roots: Root[] = []

const render = async (props: Partial<Parameters<typeof BugsSection>[0]> = {}) => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div')
  document.body.append(host)
  const mounted = createRoot(host)
  roots.push(mounted)
  await act(async () => mounted.render(<BugsSection area={areaBugs()} snapshotDate="2026-11-02" host="skello.atlassian.net" now={NOW} teams={fixtureTeams} {...props} />))
  return host
}

const items = (host: HTMLElement, label: string) => {
  const region = byRole(host, 'region', label)
  return region === null ? [] : allByRole(region, 'listitem').map(li => li.textContent ?? '')
}
const footer = (host: HTMLElement) => byText(host, /^Jira snapshot of/)?.textContent

afterEach(async () => {
  await act(async () => roots.splice(0).forEach(r => r.unmount()))
  document.body.innerHTML = ''
})

describe('BugsSection', () => {
  it('heads the section Bugs and states the counts', async () => {
    const host = await render()
    expect(byRole(host, 'heading', 'Bugs')).not.toBeNull()
    expect(host.textContent).toContain('12 open · 3 past SLA · 27 opened in 90 days')
  })
  it('draws the weekly BRs opened with the current week hollow and partial', async () => {
    const host = await render()
    const spark = byRole(host, 'img', /^BRs opened per week/)
    expect(spark?.getAttribute('aria-label')).toBe('BRs opened per week, max 4, last 3; the last point is the snapshot week, partial')
    expect(spark?.querySelectorAll('polyline')).toHaveLength(1)
    expect(spark?.querySelectorAll('circle')).toHaveLength(1)
  })
  it('lists the Feature Areas most open first', async () => {
    const host = await render()
    expect(items(host, 'Feature Areas')).toEqual(['Rounding 7 open · 2 past SLA', 'Badges 3 open · 1 past SLA', 'Exports 2 open · 0 past SLA'])
  })
  it('renders the Feature Areas in the order the overlay gives', async () => {
    const featureAreas = [
      { name: 'Zones', open: 1, breached: 0, opened90d: 1 },
      { name: 'Alerts', open: 5, breached: 0, opened90d: 1 },
    ]
    const host = await render({ area: areaBugs({ featureAreas }) })
    expect(items(host, 'Feature Areas').map(i => i.split(' ')[0])).toEqual(['Zones', 'Alerts'])
  })
  it('names each team, No team for bugs on no board, and the id of an unknown team', async () => {
    const teams = [{ teamId: 'team-anchovy', open: 8 }, { teamId: 'team-ghost', open: 2 }, { teamId: null, open: 4 }]
    const host = await render({ area: areaBugs({ teams }) })
    expect(items(host, 'Teams')).toEqual(['Team Anchovy 8 open', 'team-ghost 2 open', 'No team 4 open'])
  })
  it('leaves out the empty lists', async () => {
    const host = await render({ area: areaBugs({ featureAreas: [], teams: [] }) })
    expect(byRole(host, 'region', 'Feature Areas')).toBeNull()
    expect(byRole(host, 'region', 'Teams')).toBeNull()
  })
  it('links Open in Jira to the encoded JQL in a new tab', async () => {
    const host = await render()
    const link = byRole(host, 'link', 'Open in Jira')
    expect(link?.getAttribute('href')).toBe(`https://skello.atlassian.net/issues/?jql=${encodeURIComponent(areaBugs().jql)}`)
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noreferrer')
  })
  it('signs the footer with the snapshot date', async () => {
    const host = await render()
    expect(footer(host)).toBe('Jira snapshot of 2026-11-02')
  })
  it('marks a snapshot older than 7 days as stale', async () => {
    const host = await render({ snapshotDate: '2026-10-25' })
    expect(footer(host)).toContain('stale')
    const fresh = await render({ snapshotDate: '2026-10-27' })
    expect(footer(fresh)).not.toContain('stale')
  })
})
