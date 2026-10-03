import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { connectivityMap, resourceSurface } from '@dependency-explorer/data'
import { parseUrl } from '../../hooks/useUrlState'
import { validateUrlState } from '../../shell/validateUrlState'
import { FlowPage } from './FlowPage'
import { FlowStory } from './FlowStory'
import { UnitDetail } from './UnitDetail'

const noop = () => {}
const shift = connectivityMap.flows.find(f => f.id === 'shift-creation')
if (!shift) {
  throw new Error('shift-creation missing')
}
const page = (qs: string) => renderToStaticMarkup(<FlowPage flow={shift} url={validateUrlState(parseUrl(qs))} patch={noop} onBack={noop} />)

describe('FlowPage', () => {
  it('heads the flow with its trigger, a one-sentence summary and the rest under "more"', () => {
    const html = page('?page=flows&flow=shift-creation&renderer=svg')
    expect(html).toContain('<h1>Shift Creation</h1>')
    expect(html).toContain('👤 manager')
    expect(html).toContain('>A planner creates a shift on the planning page.</p>')
    expect(html).toContain('<summary>more</summary>')
  })
  it('draws the swimlanes when exploring', () => {
    const html = page('?page=flows&flow=shift-creation&renderer=svg')
    expect(html).toContain('aria-label="Shift Creation — swimlanes"')
    expect(html).not.toContain('aria-label="Chapters"')
  })
  it('tells the story when presenting, with the selected chapter marked', () => {
    const html = page('?page=flows&flow=shift-creation&renderer=svg&present=1&chapter=2')
    expect(html).toContain('aria-label="Chapters"')
    expect(html.match(/aria-current="step"/g)).toHaveLength(1)
    expect(html).toContain('aria-label="Shift Creation — swimlanes"')
  })
})

describe('FlowStory', () => {
  it('numbers the chapters and says when they are derived', () => {
    const html = renderToStaticMarkup(
      <FlowStory chapters={[{ title: 'Step 1', summary: 'GET /x', refs: ['a'] }, { title: 'Step 2', summary: 'POST /y', refs: ['b'] }]} authored={false} current={null} onSelect={noop}>
        <p>diagram</p>
      </FlowStory>,
    )
    expect(html).toContain('>1</span>')
    expect(html).toContain('Step 2')
    expect(html).toContain('Chapters derived from the steps')
  })
})

describe('UnitDetail', () => {
  it('shows a unit with its file at the pinned commit, its branches and its calls', () => {
    const html = renderToStaticMarkup(<UnitDetail flow={shift} id="cu-create-service" onOpenFlow={noop} onOpenResource={noop} onClose={noop} />)
    expect(html).toContain('V3::Shifts::CreateService')
    expect(html).toContain(`/blob/${resourceSurface.pins['skello-app']}/app/services/v3/shifts/create_service.rb`)
    expect(html).toContain('⎇ 403')
    expect(html).toContain('← V3::Api::Plannings::ShiftsController#create')
    expect(html).toContain('background job · if absence shifts only')
  })
  it('shows a store with its resources', () => {
    const html = renderToStaticMarkup(<UnitDetail flow={shift} id="pg-skello-shifts" onOpenFlow={noop} onOpenResource={noop} onClose={noop} />)
    expect(html).toContain('PostgreSQL')
    expect(html).toContain('>pg:skello_production.shifts</button>')
  })
})
