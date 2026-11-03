// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { connectivityMap, getSharedExternals } from '@dependency-explorer/data'
import { byRole } from '../../test/roles'
import { AreasHome } from './AreasHome'
import { jiraOverlayOf } from './jiraOverlayFixture'

const roots: Root[] = []

const render = async (body: unknown, status = 200) => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status })))
  const host = document.createElement('div')
  const root = createRoot(host)
  roots.push(root)
  await act(async () => root.render(<AreasHome map={connectivityMap} onOpenArea={() => {}} onOpenContext={() => {}} />))
  return host
}

afterEach(async () => {
  await act(async () => roots.splice(0).forEach(r => r.unmount()))
  vi.unstubAllGlobals()
})

describe('AreasHome', () => {
  it('lists the external systems every area shares, with the repos using them', () => {
    const shared = getSharedExternals(connectivityMap.areas ?? [], connectivityMap.externals ?? [])
    expect(shared.length).toBeGreaterThan(0)
    const html = renderToStaticMarkup(<AreasHome map={connectivityMap} onOpenArea={() => {}} onOpenContext={() => {}} />)
    expect(html).toContain('Shared by every area')
    for (const e of shared) {
      expect(html).toContain(e.name)
    }
  })
  it('links the open bugs with no product area to their JQL in a new tab', async () => {
    const overlay = jiraOverlayOf()
    const host = await render(overlay)
    const link = byRole(host, 'link', 'Bugs with no product area: 4 open')
    expect(link?.getAttribute('href')).toBe(`https://skello.atlassian.net/issues/?jql=${encodeURIComponent(overlay.unmapped.jql)}`)
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noreferrer')
  })
  it('leaves the unmapped line out when no open bug lacks a product area', async () => {
    const host = await render(jiraOverlayOf({ unmapped: { open: 0, breached: 0, jql: 'project = BR' } }))
    expect(host.textContent).not.toContain('Bugs with no product area')
  })
  it('leaves the unmapped line out without a Jira overlay', async () => {
    const host = await render({}, 404)
    expect(host.textContent).not.toContain('Bugs with no product area')
  })
})
