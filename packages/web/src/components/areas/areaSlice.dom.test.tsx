// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { connectivityMap as map, monolithRoutes, resourceSurface } from '@dependency-explorer/data'
import { areaSlice } from '../../utils/areaSlice'
import { AreaSlice } from './AreaSlice'

const planning = areaSlice(map, monolithRoutes, resourceSurface.resources, 'planning')
const noop = () => {}

describe('AreaSlice', () => {
  it.each([/^Controllers · /, /^Tables · /, /^Services it calls · /, /^Flows · /])('shows the %s section of the slice', title => {
    render(planning && <AreaSlice slice={planning} onOpenArea={noop} onOpenResource={noop} onSelectService={noop} onOpenFlow={noop} onClose={noop} />)

    expect(within(screen.getByRole('article', { name: 'Planning slice' })).getByRole('heading', { name: title })).toBeTruthy()
  })

  it('offers the slice entities and the area page', () => {
    render(planning && <AreaSlice slice={planning} onOpenArea={noop} onOpenResource={noop} onSelectService={noop} onOpenFlow={noop} onClose={noop} />)

    expect(screen.getByRole('button', { name: 'shifts' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Shift Creation' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open the area page' })).toBeTruthy()
  })

  it('closes from the named close button', async () => {
    const onClose = vi.fn()
    render(planning && <AreaSlice slice={planning} onOpenArea={noop} onOpenResource={noop} onSelectService={noop} onOpenFlow={noop} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
