// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { act, screen } from '@testing-library/react'
import { parseUrl } from '../hooks/useUrlState'
import { renderInApp } from '../test/renderInApp'
import { MicroservicesPage } from './MicroservicesPage'
import { validateUrlState } from './validateUrlState'

const noop = () => {}
const page = async (qs: string) => {
  await act(async () => {
    renderInApp(<MicroservicesPage url={validateUrlState(parseUrl(qs))} patch={noop} />, qs)
  })
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response(null, { status: 404 })))
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('MicroservicesPage', () => {
  it('maps the microservices by product area when exploring', async () => {
    await page('?page=microservices&renderer=svg')

    expect(screen.getByRole('region', { name: 'Microservices by product area' })).toBeTruthy()
  })

  it('draws each product area as a selectable box when exploring', async () => {
    await page('?page=microservices&renderer=svg')

    expect(screen.getByRole('button', { name: 'Planning' })).toBeTruthy()
  })

  it('invites selecting an area in the legend when exploring', async () => {
    await page('?page=microservices&renderer=svg')

    expect(screen.getByText('select an area to draw its connections')).toBeTruthy()
  })

  it('draws the weighted area graph when presenting', async () => {
    await page('?page=microservices&renderer=svg&present=1')

    expect(screen.getByRole('region', { name: 'How product areas connect' })).toBeTruthy()
  })

  it('offers a threshold slider when presenting', async () => {
    await page('?page=microservices&renderer=svg&present=1')

    expect(screen.getByRole('slider', { name: 'Minimum connections per edge' })).toBeTruthy()
  })

  it.each([
    ['?page=microservices&s=svc-punch&renderer=svg', 'svc-punch — grouped by how they talk'],
    ['?page=microservices&s=svc-punch&renderer=svg&present=1', 'svc-punch — neighbours by product area'],
  ])('groups the service of %s as %s', async (qs, title) => {
    await page(qs)

    expect(screen.getByRole('region', { name: title })).toBeTruthy()
  })

  it.each([
    [1, '?page=microservices&renderer=svg'],
    [0, '?page=microservices&renderer=svg&present=1'],
    [1, '?page=microservices'],
    [0, '?page=microservices&area=planning'],
    [1, '?page=microservices&s=svc-punch&drawer=svc-users'],
  ])('renders %i services list on %s', async (count, qs) => {
    await page(qs)

    expect(screen.queryAllByRole('navigation', { name: 'Services' })).toHaveLength(count)
  })
})
