// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { act, screen } from '@testing-library/react'
import { connectivityMap, type Team } from '@dependency-explorer/data'
import { renderInApp } from '../../test/renderInApp'
import { jiraOverlayOf } from '../areas/jiraOverlayFixture'
import { OwnershipPage } from './OwnershipPage'

const noop = () => {}

const renderPage = async (map: typeof connectivityMap, focusedTeam: string | null, body: unknown, status = 200) => {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status })))
  await act(async () => {
    renderInApp(<OwnershipPage map={map} focusedTeam={focusedTeam} onFocusTeam={noop} onSelectService={noop} />)
  })
}

const renderTeam = (team: Team, body: unknown, status = 200) => renderPage({ ...connectivityMap, teams: [team] }, team.id, body, status)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Ownership overview', () => {
  it.each((connectivityMap.teams ?? []).map(t => [t.name]))('lists %s', async name => {
    await renderPage(connectivityMap, null, {}, 404)

    expect(screen.getAllByText(name, { exact: false }).length).toBeGreaterThan(0)
  })

  it('keeps colours out of inline styles', async () => {
    await renderPage(connectivityMap, null, {}, 404)

    expect(screen.getByRole('region', { name: 'Service ownership' }).outerHTML).not.toMatch(/style="[^"]*(#[0-9a-fA-F]{3,8}|rgba?\()/)
  })
})

describe('Ownership team detail', () => {
  const linked: Team = { id: 'team-anchovy', name: 'Team Anchovy', jiraBoards: [17, 99], datadogTeams: ['anchovy', 'anchovy-ops'] }

  it('names the Jira boards from the overlay, and by id where it has no name', async () => {
    await renderTeam(linked, jiraOverlayOf())

    expect(screen.getByRole('region', { name: 'Jira boards' }).textContent).toBe('Jira boards: Anchovy board, 99')
  })

  it('shows the Jira board ids without a Jira overlay', async () => {
    await renderTeam(linked, {}, 404)

    expect(screen.getByRole('region', { name: 'Jira boards' }).textContent).toBe('Jira boards: 17, 99')
  })

  it('lists the Datadog teams', async () => {
    await renderTeam(linked, jiraOverlayOf())

    expect(screen.getByRole('region', { name: 'Datadog teams' }).textContent).toBe('Datadog teams: anchovy, anchovy-ops')
  })

  it('shows no Jira boards when the team has none', async () => {
    await renderTeam({ id: 'team-anchovy', name: 'Team Anchovy' }, jiraOverlayOf())

    expect(screen.queryByRole('region', { name: 'Jira boards' })).toBeNull()
  })

  it('shows no Datadog teams when the team has none', async () => {
    await renderTeam({ id: 'team-anchovy', name: 'Team Anchovy' }, jiraOverlayOf())

    expect(screen.queryByRole('region', { name: 'Datadog teams' })).toBeNull()
  })
})
