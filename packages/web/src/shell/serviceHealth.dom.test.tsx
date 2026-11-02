// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { overlayOf } from '../components/health/overlayFixture'
import { parseUrl } from '../hooks/useUrlState'
import { byRole } from '../test/roles'
import { MicroservicesPage } from './MicroservicesPage'
import { validateUrlState } from './validateUrlState'

const roots: Root[] = []

const render = async (qs: string, fetchImpl: typeof fetch) => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('fetch', fetchImpl)
  const host = document.createElement('div')
  const root = createRoot(host)
  roots.push(root)
  await act(async () => root.render(<MicroservicesPage url={validateUrlState(parseUrl(qs))} patch={() => {}} />))
  return host
}

const health = (host: HTMLElement) => byRole(host, 'region', 'Health')

afterEach(async () => {
  await act(async () => roots.splice(0).forEach(r => r.unmount()))
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Service view health', () => {
  it('renders no Health section without an overlay', async () => {
    const error = vi.spyOn(console, 'error')
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 404 }))
    const host = await render('?page=microservices&s=svc-punch&renderer=svg', fetchImpl)
    expect(health(host)).toBeNull()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(error).not.toHaveBeenCalled()
  })
  it('renders the Health section when the overlay names the service', async () => {
    const host = await render('?page=microservices&s=svc-punch&renderer=svg', vi.fn<typeof fetch>(async () => new Response(JSON.stringify(overlayOf()))))
    expect(health(host)?.textContent).toContain('Problem now')
    expect(health(host)?.textContent).toContain('Datadog snapshot of 2026-11-02')
  })
  it('renders no Health section for a service the overlay does not name', async () => {
    const host = await render('?page=microservices&s=svc-users&renderer=svg', vi.fn<typeof fetch>(async () => new Response(JSON.stringify(overlayOf()))))
    expect(health(host)).toBeNull()
  })
})
