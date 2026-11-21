// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AreaSliceData } from '../../utils/areaSlice'
import { planningArea } from '../../test/areaFixtures'
import { renderInApp } from '../../test/renderInApp'
import { AreaSlice } from './AreaSlice'

const planning: AreaSliceData = {
  area: planningArea,
  controllers: [{ name: 'V3::Api::Plannings::ShiftsController', routes: 4 }],
  tables: [{ id: 'pg:skello_production.shifts', name: 'shifts' }],
  calls: ['svc-punch'],
  flows: [{ id: 'shift-creation', name: 'Shift Creation' }],
}
const noop = () => {}

describe('AreaSlice', () => {
  it.each([/^Controllers · /, /^Tables · /, /^Services it calls · /, /^Flows · /])('shows the %s section of the slice', title => {
    renderInApp(<AreaSlice slice={planning} onOpenArea={noop} onClose={noop} />)

    expect(within(screen.getByRole('article', { name: 'Planning slice' })).getByRole('heading', { name: title })).toBeTruthy()
  })

  it.each([
    ['shifts', '/?page=resources&resource=pg%3Askello_production.shifts'],
    ['Shift Creation', '/?page=flows&flow=shift-creation'],
  ])('links the slice entity %s to its page', (name, href) => {
    renderInApp(<AreaSlice slice={planning} onOpenArea={noop} onClose={noop} />)

    expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href)
  })

  it('offers the area page', () => {
    renderInApp(<AreaSlice slice={planning} onOpenArea={noop} onClose={noop} />)

    expect(screen.getByRole('button', { name: 'Open the area page' })).toBeTruthy()
  })

  it('closes from the named close button', async () => {
    const onClose = vi.fn()
    renderInApp(<AreaSlice slice={planning} onOpenArea={noop} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
