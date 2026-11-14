// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { BugsSection } from './BugsSection'
import { areaBugs, fixtureTeams } from './jiraOverlayFixture'

const NOW = new Date('2026-11-02T12:00:00Z')

const renderBugs = (props: Partial<Parameters<typeof BugsSection>[0]> = {}) =>
  render(<BugsSection area={areaBugs()} snapshotDate="2026-11-02" host="skello.atlassian.net" now={NOW} teams={fixtureTeams} {...props} />)

const items = (label: string) =>
  within(screen.getByRole('region', { name: label })).getAllByRole('listitem').map(li => li.textContent)

const footer = () => screen.getByText(/^Jira snapshot of/).textContent

describe('BugsSection', () => {
  it('heads the section Bugs', () => {
    renderBugs()

    expect(screen.getByRole('heading', { name: 'Bugs' })).toBeTruthy()
  })

  it('states the counts', () => {
    renderBugs()

    expect(screen.getByText('12 open · 3 past SLA · 27 opened in 90 days')).toBeTruthy()
  })

  it('names the weekly BRs opened with the current week partial', () => {
    renderBugs()

    expect(screen.getByRole('img', { name: /^BRs opened per week/ }).getAttribute('aria-label'))
      .toBe('BRs opened per week, max 4, last 3; the last point is the snapshot week, partial')
  })

  it('draws the current week as a hollow point off the line', () => {
    renderBugs()

    const spark = screen.getByRole('img', { name: /^BRs opened per week/ })
    expect(spark.querySelectorAll('polyline')).toHaveLength(1)
    expect(spark.querySelectorAll('circle')).toHaveLength(1)
  })

  it('lists the Feature Areas most open first', () => {
    renderBugs()

    expect(items('Feature Areas')).toEqual(['Rounding 7 open · 2 past SLA', 'Badges 3 open · 1 past SLA', 'Exports 2 open · 0 past SLA'])
  })

  it('renders the Feature Areas in the order the overlay gives', () => {
    const featureAreas = [
      { name: 'Zones', open: 1, breached: 0, opened90d: 1 },
      { name: 'Alerts', open: 5, breached: 0, opened90d: 1 },
    ]
    renderBugs({ area: areaBugs({ featureAreas }) })

    expect(items('Feature Areas').map(i => i?.split(' ')[0])).toEqual(['Zones', 'Alerts'])
  })

  it('names each team, No team for bugs on no board, and the id of an unknown team', () => {
    const teams = [{ teamId: 'team-anchovy', open: 8 }, { teamId: 'team-ghost', open: 2 }, { teamId: null, open: 4 }]
    renderBugs({ area: areaBugs({ teams }) })

    expect(items('Teams')).toEqual(['Team Anchovy 8 open', 'team-ghost 2 open', 'No team 4 open'])
  })

  it.each(['Feature Areas', 'Teams'])('leaves out the empty %s list', name => {
    renderBugs({ area: areaBugs({ featureAreas: [], teams: [] }) })

    expect(screen.queryByRole('region', { name })).toBeNull()
  })

  it('links Open in Jira to the encoded JQL', () => {
    renderBugs()

    expect(screen.getByRole('link', { name: 'Open in Jira' }).getAttribute('href'))
      .toBe(`https://skello.atlassian.net/issues/?jql=${encodeURIComponent(areaBugs().jql)}`)
  })

  it('opens Jira in a new tab without a referrer', () => {
    renderBugs()

    const link = screen.getByRole('link', { name: 'Open in Jira' })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
  })

  it('signs the footer with the snapshot date', () => {
    renderBugs()

    expect(footer()).toBe('Jira snapshot of 2026-11-02')
  })

  it('marks a snapshot older than 7 days as stale', () => {
    renderBugs({ snapshotDate: '2026-10-25' })

    expect(footer()).toContain('stale')
  })

  it('keeps a 6-day-old snapshot fresh', () => {
    renderBugs({ snapshotDate: '2026-10-27' })

    expect(footer()).not.toContain('stale')
  })
})
