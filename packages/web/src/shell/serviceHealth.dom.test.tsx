// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, screen, within } from '@testing-library/react'
import { overlayOf } from '../components/health/overlayFixture'
import { parseUrl } from '../hooks/useUrlState'
import { renderInApp } from '../test/renderInApp'
import { MicroservicesPage } from './MicroservicesPage'
import { validateUrlState } from './validateUrlState'

const render = async (qs: string, fetchImpl: typeof fetch) => {
  vi.stubGlobal('fetch', fetchImpl)
  await act(async () => {
    renderInApp(<MicroservicesPage url={validateUrlState(parseUrl(qs))} patch={() => {}} />, qs)
  })
}

const health = () => screen.getByRole('region', { name: 'Health' })
const noOverlay = () => vi.fn<typeof fetch>(async () => new Response(null, { status: 404 }))
const datadogOnly = () => vi.fn<typeof fetch>(async (input) => (String(input).endsWith('/datadog.json') ? new Response(JSON.stringify(overlayOf())) : new Response(null, { status: 404 })))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Service view health', () => {
  it('renders no Health section without an overlay', async () => {
    await render('?page=microservices&s=svc-punch&renderer=svg', noOverlay())

    expect(screen.queryByRole('region', { name: 'Health' })).toBeNull()
  })

  it('fetches the datadog and delivery overlays once each', async () => {
    const fetchImpl = noOverlay()

    await render('?page=microservices&s=svc-punch&renderer=svg', fetchImpl)

    expect(fetchImpl.mock.calls.map(([input]) => String(input).split('/').at(-1))).toEqual(['datadog.json', 'delivery.json'])
  })

  it('logs no error without an overlay', async () => {
    const error = vi.spyOn(console, 'error')

    await render('?page=microservices&s=svc-punch&renderer=svg', noOverlay())

    expect(error).not.toHaveBeenCalled()
  })

  it.each(['Problem now', 'Datadog snapshot of 2026-11-02'])('renders the Health section with %s when the overlay names the service', async (text) => {
    await render('?page=microservices&s=svc-punch&renderer=svg', datadogOnly())

    expect(within(health()).getByText(text, { exact: false })).toBeTruthy()
  })

  it('renders no Health section for a service the overlay does not name', async () => {
    await render('?page=microservices&s=svc-users&renderer=svg', datadogOnly())

    expect(screen.queryByRole('region', { name: 'Health' })).toBeNull()
  })
})
