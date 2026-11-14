// @vitest-environment jsdom
import { beforeAll, describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { connectivityMap, resourceSurface } from '@dependency-explorer/data'
import { parseUrl } from '../../hooks/useUrlState'
import { validateUrlState } from '../../shell/validateUrlState'
import { renderWithNav } from '../../test/renderWithNav'
import { FlowPage } from './FlowPage'
import { FlowStory } from './FlowStory'
import { UnitDetail } from './UnitDetail'

const noop = () => {}
const shift = connectivityMap.flows.find(f => f.id === 'shift-creation')
const EXPLORE = '?page=flows&flow=shift-creation&renderer=svg'
const PRESENT = '?page=flows&flow=shift-creation&renderer=svg&present=1&chapter=2'
const renderPage = (qs: string) => renderWithNav(shift && <FlowPage flow={shift} url={validateUrlState(parseUrl(qs))} patch={noop} onBack={noop} />, qs)

describe('FlowPage', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('heads the flow with its name', () => {
    renderPage(EXPLORE)

    expect(screen.getByRole('heading', { level: 1, name: 'Shift Creation' })).toBeTruthy()
  })

  it('names the actor that triggers the flow', () => {
    renderPage(EXPLORE)

    expect(screen.getByText('👤 manager', { exact: false })).toBeTruthy()
  })

  it.each(['A planner creates a shift on the planning page.', 'more'])('shows %s under the name', text => {
    renderPage(EXPLORE)

    expect(screen.getByText(text)).toBeTruthy()
  })

  it('draws the swimlanes when exploring', () => {
    renderPage(EXPLORE)

    expect(screen.getAllByLabelText('Shift Creation — swimlanes').length).toBeGreaterThan(0)
    expect(screen.queryByRole('list', { name: 'Chapters' })).toBeNull()
  })

  it('tells the story when presenting, with the selected chapter marked', () => {
    renderPage(PRESENT)

    expect(screen.getByRole('list', { name: 'Chapters' })).toBeTruthy()
    expect(screen.getAllByRole('button', { current: 'step' })).toHaveLength(1)
    expect(screen.getAllByLabelText('Shift Creation — swimlanes').length).toBeGreaterThan(0)
  })
})

describe('FlowStory', () => {
  const chapters = [{ title: 'Step 1', summary: 'GET /x', refs: ['a'] }, { title: 'Step 2', summary: 'POST /y', refs: ['b'] }]

  it('numbers the chapters', () => {
    render(<FlowStory chapters={chapters} current={null} onSelect={noop}><p>diagram</p></FlowStory>)

    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('Step 2')).toBeTruthy()
    expect(screen.queryByText(/Chapters derived from the steps/)).toBeNull()
  })
})

describe('UnitDetail', () => {
  it.each([
    'V3::Shifts::CreateService',
    '⎇ 403',
    '← V3::Api::Plannings::ShiftsController#create',
    'background job · if absence shifts only',
  ])('shows %s on a unit', text => {
    renderWithNav(shift && <UnitDetail flow={shift} id="cu-create-service" onClose={noop} />)

    expect(screen.getAllByText(text, { exact: false }).length).toBeGreaterThan(0)
  })

  it('links the unit file at the pinned commit', () => {
    renderWithNav(shift && <UnitDetail flow={shift} id="cu-create-service" onClose={noop} />)

    expect(screen.getByRole('link', { name: 'app/services/v3/shifts/create_service.rb ↗' }).getAttribute('href')).toContain(`/blob/${resourceSurface.pins['skello-app']}/app/services/v3/shifts/create_service.rb`)
  })

  it('shows a store with its resources', () => {
    renderWithNav(shift && <UnitDetail flow={shift} id="pg-skello-shifts" onClose={noop} />)

    expect(screen.getAllByText('PostgreSQL', { exact: false }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'pg:skello_production.shifts' }).getAttribute('href')).toBe('/?page=resources&resource=pg%3Askello_production.shifts')
  })
})
