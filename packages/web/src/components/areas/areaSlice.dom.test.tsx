// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { connectivityMap as map, monolithRoutes, resourceSurface } from '@dependency-explorer/data'
import { areaSlice } from '../../utils/areaSlice'
import { renderInApp } from '../../test/renderInApp'
import { AreaSlice } from './AreaSlice'

const planning = areaSlice(map, monolithRoutes, resourceSurface.resources, 'planning')
const noop = () => {}

describe('AreaSlice', () => {
  it.each([/^Controllers · /, /^Tables · /, /^Services it calls · /, /^Flows · /])('shows the %s section of the slice', title => {
    renderInApp(planning && <AreaSlice slice={planning} onOpenArea={noop} onClose={noop} />)

    expect(within(screen.getByRole('article', { name: 'Planning slice' })).getByRole('heading', { name: title })).toBeTruthy()
  })

  it.each([
    ['shifts', '/?page=resources&resource=pg%3Askello_production.shifts'],
    ['Shift Creation', '/?page=flows&flow=shift-creation'],
  ])('links the slice entity %s to its page', (name, href) => {
    renderInApp(planning && <AreaSlice slice={planning} onOpenArea={noop} onClose={noop} />)

    expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href)
  })

  it('offers the area page', () => {
    renderInApp(planning && <AreaSlice slice={planning} onOpenArea={noop} onClose={noop} />)

    expect(screen.getByRole('button', { name: 'Open the area page' })).toBeTruthy()
  })

  it('closes from the named close button', async () => {
    const onClose = vi.fn()
    renderInApp(planning && <AreaSlice slice={planning} onOpenArea={noop} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
