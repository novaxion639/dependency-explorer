// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fixtureMap as map } from '../../test/areaFixtures'
import { renderInApp } from '../../test/renderInApp'
import { AreaPage } from './AreaPage'
import { areaBugs, jiraOverlayOf } from './jiraOverlayFixture'

const noop = () => {}
const areaId = 'onboarding'

const render = async (body: unknown, status = 200, page: Partial<Parameters<typeof AreaPage>[0]> = {}) => {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status })))
  await act(async () => {
    renderInApp(<AreaPage map={map} areaId={areaId} term={null} renderer="svg" onRenderer={noop} onBack={noop} onOpenArea={noop} onSelectService={noop} {...page} />)
  })
}

const headings = () => screen.getAllByRole('heading').map(h => h.textContent)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AreaPage with the Jira overlay', () => {
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

describe('AreaPage map', () => {
  it('says so when no connection leaves the area', async () => {
    await render({}, 404)

    expect(screen.getByRole('region', { name: 'Map' }).textContent).toContain('No connection crosses into another area.')
  })

  it('draws the crossings with the shared diagram and its tools', async () => {
    await render({}, 404, { areaId: 'time-attendance' })

    expect(screen.getByRole('region', { name: 'How Time & Attendance connects to other areas' })).toBeTruthy()
    expect(screen.getByRole('toolbar', { name: 'Diagram tools' })).toBeTruthy()
  })

  it('opens another area from its node', async () => {
    const onOpenArea = vi.fn()
    await render({}, 404, { areaId: 'time-attendance', onOpenArea })

    await userEvent.click(screen.getByRole('button', { name: 'Planning' }))

    expect(onOpenArea).toHaveBeenCalledWith('planning')
  })

  it('selects a service from its node', async () => {
    const onSelectService = vi.fn()
    await render({}, 404, { areaId: 'time-attendance', onSelectService })

    await userEvent.click(screen.getByRole('button', { name: 'svc-punch' }))

    expect(onSelectService).toHaveBeenCalledWith('svc-punch')
  })
})
