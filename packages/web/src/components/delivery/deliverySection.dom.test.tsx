// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, screen, within } from '@testing-library/react'
import { renderInApp } from '../../test/renderInApp'
import { overlayOf, serviceHealth } from '../health/overlayFixture'
import { parseUrl } from '../../hooks/useUrlState'
import { MicroservicesPage } from '../../shell/MicroservicesPage'
import { validateUrlState } from '../../shell/validateUrlState'
import { DeliverySection } from './DeliverySection'
import { RELEASE_SHA, deliveryOverlayOf, deliveryService } from './deliveryOverlayFixture'

const render = (props: Partial<Parameters<typeof DeliverySection>[0]> = {}) =>
  renderInApp(<DeliverySection delivery={deliveryService()} verdict={null} {...props} />)

const region = () => screen.getByRole('region', { name: 'Delivery' })
const indexIn = (text: string, parts: string[]) => parts.map((part) => text.indexOf(part))
const LONG_TITLE = 'feat: rebuild the search index from the planning events with a backfill for every shop'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DeliverySection', () => {
  it('heads the section Delivery', () => {
    render()

    expect(within(region()).getByRole('heading', { name: 'Delivery' })).toBeTruthy()
  })

  it('reads upstream to prod: count, oldest title, age, then the release', () => {
    render()

    const positions = indexIn(region().textContent ?? '', ['2 on staging', 'feat: search by tag', '2 d', 'in prod v1.31.0', '9 Nov'])
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('names the staging step and the release', () => {
    render()

    expect(within(region()).getAllByRole('listitem').map((li) => li.getAttribute('aria-label'))).toEqual([
      '2 on staging, oldest feat: search by tag, 2 working days',
      'in prod v1.31.0, 9 Nov',
    ])
  })

  it('dims an age of 0 working days', () => {
    const steps = [{ branch: 'staging' as const, count: 1, oldest: { sha: 'b2', title: 'fix: index refresh', mergedAt: '2026-11-09T10:00:00+01:00', workingDays: 0 } }]
    render({ delivery: deliveryService({ steps }) })

    expect(screen.getByText('0 d').className).not.toBe('')
  })

  it('cuts a long title with an ellipsis', () => {
    const steps = [{ branch: 'staging' as const, count: 1, oldest: { sha: 'c3', title: LONG_TITLE, mergedAt: '2026-11-06T10:00:00+01:00', workingDays: 2 } }]
    render({ delivery: deliveryService({ steps }) })

    const step = screen.getByRole('listitem', { name: /^1 on staging/ })
    expect(step.textContent).toContain('…')
    expect(step.textContent).not.toContain(LONG_TITLE)
  })

  it('keeps a long title whole in the accessible name', () => {
    const steps = [{ branch: 'staging' as const, count: 1, oldest: { sha: 'c3', title: LONG_TITLE, mergedAt: '2026-11-06T10:00:00+01:00', workingDays: 2 } }]
    render({ delivery: deliveryService({ steps }) })

    expect(screen.getByRole('listitem', { name: `1 on staging, oldest ${LONG_TITLE}, 2 working days` })).toBeTruthy()
  })

  it.each(['Nothing on its way to prod', 'in prod v1.31.0, 9 Nov'])('lists %s without steps', (name) => {
    render({ delivery: deliveryService({ steps: [] }) })

    expect(within(region()).getByRole('listitem', { name })).toBeTruthy()
  })

  it('flags a late service and states its rule to every reader', () => {
    render({ delivery: deliveryService({ late: true }) })

    const late = screen.getByText('Late for prod')
    expect(late.textContent).toBe('Late for prod: oldest change waiting 3 working days or more')
    expect(late.getAttribute('title')).toBe('Oldest change waiting 3 working days or more')
  })

  it('flags lateness without a live status', () => {
    render({ delivery: deliveryService({ late: true }) })

    expect(screen.queryAllByRole('status')).toEqual([])
  })

  it('does not flag a service on time', () => {
    render()

    expect(screen.queryByText('Late for prod')).toBeNull()
  })

  it('labels the last release with its Datadog verdict', () => {
    render({ verdict: 'regressed' })

    expect(screen.getByRole('listitem', { name: 'in prod v1.31.0, 9 Nov, Regressed' }).textContent).toContain('Regressed')
  })

  it('says no release reached prod without a last release', () => {
    render({ delivery: deliveryService({ lastRelease: null }) })

    expect(screen.getByRole('listitem', { name: 'No release in prod' })).toBeTruthy()
  })

  it.each([
    ['2026-11-09T08:00:00.000Z', 'Branches as of 9 Nov'],
    [null, 'Branches never fetched by discovery'],
  ])('signs the footer for a fetch at %s', (fetchedAt, footer) => {
    render({ delivery: deliveryService({ fetchedAt }) })

    expect(within(region()).getByText(footer)).toBeTruthy()
  })
})

describe('Service view delivery', () => {
  const page = async (overlays: Record<string, unknown>) => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async (input) => {
      const name = /overlay\/([a-z-]+)\.json/.exec(String(input))?.[1] ?? ''
      return name in overlays ? new Response(JSON.stringify(overlays[name])) : new Response(null, { status: 404 })
    }))
    await act(async () => {
      renderInApp(<MicroservicesPage url={validateUrlState(parseUrl('?page=microservices&s=svc-punch&renderer=svg'))} patch={() => {}} />)
    })
  }
  const sections = () => screen.getAllByRole('region').map((r) => r.getAttribute('aria-label')).filter((l) => l === 'Delivery' || l === 'Health')

  it('renders no Delivery section without the delivery overlay', async () => {
    await page({ datadog: overlayOf() })

    expect(sections()).toEqual(['Health'])
  })

  it('renders Delivery above Health when both overlays exist', async () => {
    await page({ datadog: overlayOf(), delivery: deliveryOverlayOf({ 'svc-punch': deliveryService() }) })

    expect(sections()).toEqual(['Delivery', 'Health'])
  })

  it('labels the release with its Datadog verdict when both overlays exist', async () => {
    const datadog = overlayOf({ services: { 'svc-punch': serviceHealth({ releases: [{ sha: RELEASE_SHA, title: 'release', mergedAt: '2026-11-09T14:00:00Z', verdict: 'steady' }] }) } })

    await page({ datadog, delivery: deliveryOverlayOf({ 'svc-punch': deliveryService() }) })

    expect(screen.getByRole('listitem', { name: 'in prod v1.31.0, 9 Nov, Steady' })).toBeTruthy()
  })

  it('shows no verdict when the Datadog overlay lacks the sha', async () => {
    await page({ datadog: overlayOf(), delivery: deliveryOverlayOf({ 'svc-punch': deliveryService() }) })

    expect(screen.getByRole('listitem', { name: 'in prod v1.31.0, 9 Nov' })).toBeTruthy()
  })

  it('renders Delivery alone when only the delivery overlay exists', async () => {
    await page({ delivery: deliveryOverlayOf({ 'svc-punch': deliveryService() }) })

    expect(sections()).toEqual(['Delivery'])
  })
})
