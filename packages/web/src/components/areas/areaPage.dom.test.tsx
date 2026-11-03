// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { connectivityMap } from '@dependency-explorer/data'
import { allByRole, byRole } from '../../test/roles'
import { AreaPage } from './AreaPage'
import { areaBugs, jiraOverlayOf } from './jiraOverlayFixture'

const noop = () => {}
const area = (connectivityMap.areas ?? []).filter(a => a.kind === 'product')[0]
const areaId = area?.id ?? ''
const map = { ...connectivityMap, areas: area ? [area] : [] }
const roots: Root[] = []

const render = async (body: unknown, status = 200) => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status })))
  const host = document.createElement('div')
  const root = createRoot(host)
  roots.push(root)
  await act(async () => root.render(<AreaPage map={map} areaId={areaId} term={null} onBack={noop} onOpenFlow={noop} onOpenArea={noop} onSelectService={noop} />))
  return host
}

afterEach(async () => {
  await act(async () => roots.splice(0).forEach(r => r.unmount()))
  vi.unstubAllGlobals()
})

describe('AreaPage with the Jira overlay', () => {
  it('finds a product area in the map', () => {
    expect(areaId).not.toBe('')
  })
  it('renders the Bugs section after the existing sections when the overlay names the area', async () => {
    const host = await render(jiraOverlayOf({ areas: { [areaId]: areaBugs() } }))
    const headings = allByRole(host, 'heading').map(h => h.textContent)
    expect(headings.indexOf('External systems')).toBeGreaterThan(0)
    expect(headings.indexOf('Bugs')).toBeGreaterThan(headings.indexOf('External systems'))
    expect(byRole(host, 'region', 'Bugs')?.textContent).toContain('12 open · 3 past SLA · 27 opened in 90 days')
  })
  it('renders no Bugs section when the overlay does not name the area', async () => {
    const host = await render(jiraOverlayOf())
    expect(byRole(host, 'region', 'Bugs')).toBeNull()
  })
  it('renders no Bugs section without a Jira overlay', async () => {
    const host = await render({}, 404)
    expect(byRole(host, 'region', 'Bugs')).toBeNull()
    expect(byRole(host, 'heading', 'External systems')).not.toBeNull()
  })
})
