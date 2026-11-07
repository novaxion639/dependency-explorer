// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { connectivityMap, type Team } from '@dependency-explorer/data'
import { byRole } from '../../test/roles'
import { jiraOverlayOf } from '../areas/jiraOverlayFixture'
import { OwnershipPage } from './OwnershipPage'

const roots: Root[] = []

const renderTeam = async (team: Team, body: unknown, status = 200) => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status })))
  const host = document.createElement('div')
  const root = createRoot(host)
  roots.push(root)
  const map = { ...connectivityMap, teams: [team] }
  await act(async () => root.render(<OwnershipPage map={map} focusedTeam={team.id} onFocusTeam={() => {}} onSelectService={() => {}} onOpenArea={() => {}} />))
  return host
}

afterEach(async () => {
  await act(async () => roots.splice(0).forEach(r => r.unmount()))
  vi.unstubAllGlobals()
})

it('lists every team and keeps colours out of inline styles', () => {
  const html = renderToStaticMarkup(<OwnershipPage map={connectivityMap} focusedTeam={null} onFocusTeam={() => {}} onSelectService={() => {}} onOpenArea={() => {}} />)
  for (const team of connectivityMap.teams ?? []) {
    expect(html, team.id).toContain(team.name)
  }
  expect(html).not.toMatch(/style="[^"]*(#[0-9a-fA-F]{3,8}|rgba?\()/)
})

describe('Ownership team detail', () => {
  const linked: Team = { id: 'team-anchovy', name: 'Team Anchovy', jiraBoards: [17, 99], datadogTeams: ['anchovy', 'anchovy-ops'] }

  it('names the Jira boards from the overlay, and by id where it has no name', async () => {
    const host = await renderTeam(linked, jiraOverlayOf())
    expect(byRole(host, 'region', 'Jira boards')?.textContent).toBe('Jira boards: Anchovy board, 99')
  })
  it('shows the Jira board ids without a Jira overlay', async () => {
    const host = await renderTeam(linked, {}, 404)
    expect(byRole(host, 'region', 'Jira boards')?.textContent).toBe('Jira boards: 17, 99')
  })
  it('lists the Datadog teams', async () => {
    const host = await renderTeam(linked, jiraOverlayOf())
    expect(byRole(host, 'region', 'Datadog teams')?.textContent).toBe('Datadog teams: anchovy, anchovy-ops')
  })
  it('shows neither when the team has no board and no Datadog team', async () => {
    const host = await renderTeam({ id: 'team-anchovy', name: 'Team Anchovy' }, jiraOverlayOf())
    expect(byRole(host, 'region', 'Jira boards')).toBeNull()
    expect(byRole(host, 'region', 'Datadog teams')).toBeNull()
  })
})
