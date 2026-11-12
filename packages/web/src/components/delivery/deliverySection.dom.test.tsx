// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { allByRole, byRole, byText } from '../../test/roles'
import { overlayOf, serviceHealth } from '../health/overlayFixture'
import { parseUrl } from '../../hooks/useUrlState'
import { MicroservicesPage } from '../../shell/MicroservicesPage'
import { validateUrlState } from '../../shell/validateUrlState'
import { DeliverySection } from './DeliverySection'
import { RELEASE_SHA, deliveryOverlayOf, deliveryService } from './deliveryOverlayFixture'

const roots: Root[] = []

const mount = async (node: ReactNode) => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  roots.push(root)
  await act(async () => root.render(node))
  return host
}

const render = (props: Partial<Parameters<typeof DeliverySection>[0]> = {}) =>
  mount(<DeliverySection delivery={deliveryService()} verdict={null} {...props} />)

const region = (host: HTMLElement) => byRole(host, 'region', 'Delivery')
const indexIn = (text: string, parts: string[]) => parts.map((part) => text.indexOf(part))

afterEach(async () => {
  await act(async () => roots.splice(0).forEach((r) => r.unmount()))
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('DeliverySection', () => {
  it('reads upstream to prod: count, oldest title, age, then the release', async () => {
    const host = await render({ delivery: deliveryService({ steps: deliveryService().steps.slice(0, 1) }) })
    expect(byRole(host, 'heading', 'Delivery')).not.toBeNull()
    const text = region(host)?.textContent ?? ''
    const positions = indexIn(text, ['2 on sandbox', 'feat: search by tag', '2 d', 'in prod v1.31.0', '9 Nov'])
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('lists the sandbox step before the staging step', async () => {
    const host = await render()
    expect(allByRole(host, 'listitem').map((li) => li.getAttribute('aria-label'))).toEqual([
      '2 on sandbox, oldest feat: search by tag, 2 working days',
      '1 on staging, oldest fix: index refresh, 0 working days',
      'in prod v1.31.0, 9 Nov',
    ])
  })

  it('cuts a long title with an ellipsis and keeps it whole in the accessible name', async () => {
    const title = 'feat: rebuild the search index from the planning events with a backfill for every shop'
    const steps = [{ branch: 'sandbox' as const, count: 1, oldest: { sha: 'c3', title, mergedAt: '2026-11-06T10:00:00+01:00', workingDays: 2 } }]
    const host = await render({ delivery: deliveryService({ steps }) })
    const step = byRole(host, 'listitem', /^1 on sandbox/)
    expect(step?.textContent).toContain('…')
    expect(step?.textContent).not.toContain(title)
    expect(step?.getAttribute('aria-label')).toContain(title)
  })

  it('says nothing is on its way to prod without steps', async () => {
    const host = await render({ delivery: deliveryService({ steps: [] }) })
    expect(region(host)?.textContent).toContain('Nothing on its way to prod')
    expect(region(host)?.textContent).toContain('in prod v1.31.0')
  })

  it('flags a late service and states its rule to every reader', async () => {
    const host = await render({ delivery: deliveryService({ late: true }) })
    const late = byText(host, /^Late for prod/)
    expect(late?.textContent).toBe('Late for prod: oldest change waiting 3 working days or more')
    expect(late?.getAttribute('title')).toBe('Oldest change waiting 3 working days or more')
    expect(allByRole(host, 'status')).toEqual([])
    expect(byText(await render(), /^Late for prod/)).toBeNull()
  })

  it('labels the last release with its Datadog verdict', async () => {
    const host = await render({ verdict: 'regressed' })
    expect(byRole(host, 'listitem', 'in prod v1.31.0, 9 Nov, Regressed')?.textContent).toContain('Regressed')
  })

  it('says no release reached prod without a last release', async () => {
    const host = await render({ delivery: deliveryService({ lastRelease: null }) })
    expect(byRole(host, 'listitem', 'No release in prod')).not.toBeNull()
  })

  it('signs the footer with the fetch date', async () => {
    expect(region(await render())?.textContent).toContain('Branches as of 9 Nov')
    expect(region(await render({ delivery: deliveryService({ fetchedAt: null }) }))?.textContent).toContain('Branches never fetched by discovery')
  })
})

describe('Service view delivery', () => {
  const page = (overlays: Record<string, unknown>) => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async (input) => {
      const name = /overlay\/([a-z-]+)\.json/.exec(String(input))?.[1] ?? ''
      return name in overlays ? new Response(JSON.stringify(overlays[name])) : new Response(null, { status: 404 })
    }))
    return mount(<MicroservicesPage url={validateUrlState(parseUrl('?page=microservices&s=svc-punch&renderer=svg'))} patch={() => {}} />)
  }
  const sections = (host: HTMLElement) => allByRole(host, 'region').map((r) => r.getAttribute('aria-label')).filter((l) => l === 'Delivery' || l === 'Health')

  it('renders no Delivery section without the delivery overlay', async () => {
    expect(sections(await page({ datadog: overlayOf() }))).toEqual(['Health'])
  })

  it('renders Delivery above Health with the release verdict when both overlays exist', async () => {
    const datadog = overlayOf({ services: { 'svc-punch': serviceHealth({ releases: [{ sha: RELEASE_SHA, title: 'release', mergedAt: '2026-11-09T14:00:00Z', verdict: 'steady' }] }) } })
    const host = await page({ datadog, delivery: deliveryOverlayOf({ 'svc-punch': deliveryService() }) })
    expect(sections(host)).toEqual(['Delivery', 'Health'])
    expect(byRole(host, 'listitem', 'in prod v1.31.0, 9 Nov, Steady')).not.toBeNull()
  })

  it('shows no verdict when the Datadog overlay lacks the sha', async () => {
    const host = await page({ datadog: overlayOf(), delivery: deliveryOverlayOf({ 'svc-punch': deliveryService() }) })
    expect(byRole(host, 'listitem', 'in prod v1.31.0, 9 Nov')).not.toBeNull()
  })

  it('renders Delivery alone when only the delivery overlay exists', async () => {
    expect(sections(await page({ delivery: deliveryOverlayOf({ 'svc-punch': deliveryService() }) }))).toEqual(['Delivery'])
  })
})
