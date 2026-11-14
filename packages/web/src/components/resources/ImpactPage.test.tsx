// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { selectServicePatch } from '../../hooks/useUrlState'
import { renderInApp } from '../../test/renderInApp'
import { ImpactPage } from './ImpactPage'

const noop = () => {}

describe('ImpactPage', () => {
  it('lists the directed impact of a service by hop with effects and affected flows', () => {
    renderInApp(<ImpactPage origin="svc-requests" onSelect={noop} onPick={noop} />)

    expect(screen.getByRole('region', { name: 'Impact of svc-requests' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Hop 1' })).toBeTruthy()
    expect(screen.getAllByText('fails').length).toBeGreaterThan(0)
    expect(screen.getByRole('region', { name: 'Affected flows' })).toBeTruthy()
  })

  it('labels the page once, without a redundant region role', () => {
    renderInApp(<ImpactPage origin="svc-requests" onSelect={noop} onPick={noop} />)

    expect(screen.getByRole('region', { name: 'Impact of svc-requests' }).outerHTML).not.toContain('role="region"')
  })

  it('impacts a resource through its relations', () => {
    renderInApp(<ImpactPage origin="sqs:createActivityLogJob" onSelect={noop} onPick={noop} />)

    expect(screen.getByRole('link', { name: 'svc-requests' })).toBeTruthy()
  })

  it('opens an impacted service from its link', async () => {
    const { onNavigate } = renderInApp(<ImpactPage origin="sqs:createActivityLogJob" onSelect={noop} onPick={noop} />)

    await userEvent.click(screen.getByRole('link', { name: 'svc-requests' }))

    expect(onNavigate).toHaveBeenCalledWith(selectServicePatch('svc-requests'), undefined)
  })

  it('marks failures beyond the first hop as possible', () => {
    renderInApp(<ImpactPage origin="svc-requests" onSelect={noop} onPick={noop} />)

    expect(screen.getAllByText('may fail').length).toBeGreaterThan(0)
  })

  it('keeps the map folded until asked', () => {
    renderInApp(<ImpactPage origin="svc-requests" onSelect={noop} onPick={noop} />)

    expect(screen.getByRole('button', { name: 'Show on the map' }).getAttribute('aria-expanded')).toBe('false')
  })
})
