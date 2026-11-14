// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { connectivityMap } from '@dependency-explorer/data'
import { resourcePatch } from '../../hooks/useUrlState'
import { renderInApp } from '../../test/renderInApp'
import { ListenerFacts } from './ListenerFacts'

const mount = (id: string, flowId = 'shift-update') => {
  const flow = connectivityMap.flows.find(f => f.id === flowId)
  const unit = (flow?.codeUnits ?? []).find(u => u.id === id)
  return renderInApp(flow && unit && <ListenerFacts flow={flow} unit={unit} />)
}

const rowOf = (element: HTMLElement): HTMLElement => {
  const row = element.closest('li')
  if (!row) {
    throw new Error('element is not inside a list row')
  }
  return row
}

describe('ListenerFacts', () => {
  it('shows what the update service’s shift write fires', () => {
    mount('cu-upd-service')

    expect(screen.getByRole('heading', { name: 'Fires' })).toBeTruthy()
    expect(screen.getAllByText('update_paid_leaves', { exact: false }).length).toBeGreaterThan(0)
  })

  it('marks a text-graded write site unverified', () => {
    mount('cu-upd-service')

    expect(screen.getAllByRole('img', { name: /^unverified/ }).length).toBeGreaterThan(0)
  })

  it('opens the written table', async () => {
    const { onNavigate } = mount('cu-upd-service')

    await userEvent.click(screen.getByRole('link', { name: 'shifts' }))

    expect(onNavigate).toHaveBeenCalledWith(resourcePatch('pg:skello_production.shifts'), undefined)
  })

  it('lists the derived listeners and the drift on the callback unit', () => {
    mount('cu-upd-callbacks')

    expect(screen.getByRole('heading', { name: 'Derived listeners' })).toBeTruthy()
    expect(screen.getAllByText('⚠ missing', { exact: false }).length).toBeGreaterThan(0)
    expect(screen.getAllByText('⚠ unsupported', { exact: false }).length).toBeGreaterThan(0)
    expect(screen.getAllByText('app/jobs/shifts/shift_data_updater_job.rb', { exact: false }).length).toBeGreaterThan(0)
  })

  it('links the table the cascade reaches through the shifts listeners', () => {
    mount('cu-upd-service')

    expect(screen.getAllByRole('link', { name: 'predicted_shifts' }).map(l => l.getAttribute('href'))).toContain('/?page=resources&resource=pg%3Askello_production.predicted_shifts')
  })

  it('reads runs none with the call for a write that skips every listener', () => {
    mount('cu-upd-service')

    expect(screen.getAllByText('runs none (update_all)', { exact: false }).length).toBeGreaterThan(0)
  })

  it('labels a table-event link unverified', () => {
    mount('cu-ss-prospect', 'self-serve-signup')

    expect(screen.getAllByText('by table event — unverified', { exact: false }).length).toBeGreaterThan(0)
  })

  it('renders nothing for a unit with no writes and no callbacks', () => {
    mount('cu-upd-controller')

    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('shows a cascade hop under a text-graded write as unverified', () => {
    mount('cu-upd-service')
    const [firstHop] = screen.getAllByRole('link', { name: 'predicted_shifts' })

    expect(within(rowOf(firstHop ?? document.body)).getAllByRole('img', { name: /^unverified/ }).length).toBeGreaterThan(0)
  })

  it('shows each write site’s source', () => {
    mount('cu-upd-service')

    expect(screen.getAllByText(/app\/\S+\.rb:\d+/).length).toBeGreaterThan(0)
  })

  it('shows no source on a table-event row', () => {
    mount('cu-ss-prospect', 'self-serve-signup')
    const [glyph] = screen.getAllByRole('img', { name: 'unverified, matched by table event' })

    expect(rowOf(glyph ?? document.body).textContent?.split('→')[0]).not.toMatch(/\.rb:\d+/)
  })

  it('announces a table-event row as matched by table event', () => {
    mount('cu-ss-prospect', 'self-serve-signup')

    expect(screen.getAllByRole('img', { name: 'unverified, matched by table event' }).length).toBeGreaterThan(0)
  })

  it('prefixes each derived listener with its table', () => {
    mount('cu-upd-callbacks')

    expect(screen.getAllByText(/^shifts · after_commit /).length).toBeGreaterThan(0)
  })
})
