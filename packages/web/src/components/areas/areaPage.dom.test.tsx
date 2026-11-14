// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { screen } from '@testing-library/react'
import { connectivityMap } from '@dependency-explorer/data'
import { renderInApp } from '../../test/renderInApp'
import { AreaPage } from './AreaPage'
import { areaBugs, jiraOverlayOf } from './jiraOverlayFixture'

const noop = () => {}
const map = { ...connectivityMap, areas: (connectivityMap.areas ?? []).filter(a => a.kind === 'product').slice(0, 1) }
const areaId = map.areas[0]?.id ?? ''

const render = async (body: unknown, status = 200) => {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status })))
  await act(async () => {
    renderInApp(<AreaPage map={map} areaId={areaId} term={null} onBack={noop} onOpenArea={noop} onSelectService={noop} />)
  })
}

const headings = () => screen.getAllByRole('heading').map(h => h.textContent)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AreaPage with the Jira overlay', () => {
  it('finds a product area in the map', () => {
    expect(areaId).not.toBe('')
  })

  it('renders the Bugs section after the existing sections when the overlay names the area', async () => {
    await render(jiraOverlayOf({ areas: { [areaId]: areaBugs() } }))

    expect(headings().indexOf('Bugs')).toBeGreaterThan(headings().indexOf('External systems'))
    expect(headings().indexOf('External systems')).toBeGreaterThan(0)
  })

  it('counts the open, past-SLA and recent bugs of the area', async () => {
    await render(jiraOverlayOf({ areas: { [areaId]: areaBugs() } }))

    expect(screen.getByRole('region', { name: 'Bugs' }).textContent).toContain('12 open · 3 past SLA · 27 opened in 90 days')
  })

  it('renders no Bugs section when the overlay does not name the area', async () => {
    await render(jiraOverlayOf())

    expect(screen.queryByRole('region', { name: 'Bugs' })).toBeNull()
  })

  it('renders no Bugs section without a Jira overlay', async () => {
    await render({}, 404)

    expect(screen.queryByRole('region', { name: 'Bugs' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'External systems' })).toBeTruthy()
  })
})
