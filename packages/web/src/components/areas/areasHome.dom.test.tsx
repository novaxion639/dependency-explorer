// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { act, screen } from '@testing-library/react'
import { connectivityMap, getSharedExternals } from '@dependency-explorer/data'
import { renderInApp } from '../../test/renderInApp'
import { AreasHome } from './AreasHome'
import { jiraOverlayOf } from './jiraOverlayFixture'

const noop = () => {}
const shared = getSharedExternals(connectivityMap.areas ?? [], connectivityMap.externals ?? [])
const platform = (connectivityMap.areas ?? []).filter(a => a.kind === 'platform')

const renderWithOverlay = async (body: unknown, status = 200) => {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status })))
  await act(async () => {
    renderInApp(<AreasHome map={connectivityMap} onOpenContext={noop} />)
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AreasHome', () => {
  it('heads the external systems every area shares', async () => {
    await renderWithOverlay({}, 404)

    expect(screen.getByText('Shared by every area')).toBeTruthy()
  })

  it.each(shared.map(e => [e.name]))('lists the shared external system %s', async name => {
    await renderWithOverlay({}, 404)

    expect(screen.getAllByText(name, { exact: false }).length).toBeGreaterThan(0)
  })

  it.each(platform.map(a => [a.name, a.id]))('links the %s platform capability to its area page', async (name, id) => {
    await renderWithOverlay({}, 404)

    expect(screen.getAllByRole('link', { name }).map(link => link.getAttribute('href'))).toContain(`/?page=areas&area=${id}`)
  })

  it('links the open bugs with no product area to their JQL in a new tab', async () => {
    const overlay = jiraOverlayOf()
    await renderWithOverlay(overlay)

    const link = screen.getByRole('link', { name: 'Bugs with no product area: 4 open' })

    expect(link.getAttribute('href')).toBe(`https://skello.atlassian.net/issues/?jql=${encodeURIComponent(overlay.unmapped.jql)}`)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
  })

  it('leaves the unmapped line out when no open bug lacks a product area', async () => {
    await renderWithOverlay(jiraOverlayOf({ unmapped: { open: 0, breached: 0, jql: 'project = BR' } }))

    expect(screen.queryByText(/Bugs with no product area/)).toBeNull()
  })

  it('leaves the unmapped line out without a Jira overlay', async () => {
    await renderWithOverlay({}, 404)

    expect(screen.queryByText(/Bugs with no product area/)).toBeNull()
  })
})

describe('AreasHome product cards', () => {
  it('link each product area to its page', async () => {
    await renderWithOverlay({}, 404)

    expect(screen.getByRole('link', { name: /^Planning/ }).getAttribute('href')).toBe('/?page=areas&area=planning')
  })
})
