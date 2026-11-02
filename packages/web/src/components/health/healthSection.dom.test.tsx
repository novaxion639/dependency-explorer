// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { HealthSection } from './HealthSection'
import { serviceHealth } from './overlayFixture'

const NOW = new Date('2026-11-02T12:00:00Z')
const roots: Root[] = []

const render = async (props: Partial<Parameters<typeof HealthSection>[0]> = {}) => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div')
  document.body.append(host)
  const mounted = createRoot(host)
  roots.push(mounted)
  await act(async () => mounted.render(<HealthSection health={serviceHealth()} snapshotDate="2026-11-02" eventsCapped={false} now={NOW} {...props} />))
  return host
}

const items = (host: HTMLElement, label: string) => [...(host.querySelector(`section[aria-label="${label}"]`)?.querySelectorAll('li') ?? [])].map(li => li.textContent ?? '')

afterEach(async () => {
  await act(async () => roots.splice(0).forEach(r => r.unmount()))
  document.body.innerHTML = ''
})

describe('HealthSection', () => {
  it('heads the section Health and states the problem with its reason', async () => {
    const host = await render()
    expect(host.querySelector('h2')?.textContent).toBe('Health')
    expect(host.textContent).toContain('Problem now')
    expect(host.textContent).toContain('5xx 4.1× (+63) over 72 h')
  })
  it.each([
    ['dig', 'To dig into'],
    ['fellBack', 'Fell back'],
    ['healthy', 'Healthy'],
    ['noData', 'No data'],
  ] as const)('names the %s state', async (state, label) => {
    const host = await render({ health: serviceHealth({ state, reasons: [] }) })
    expect(host.textContent).toContain(label)
  })
  it('lists the monitors, marking the noisy one', async () => {
    const host = await render()
    const monitors = items(host, 'Monitors')
    expect(monitors).toHaveLength(2)
    expect(monitors[0]).toContain('svc-punch 5xx rate')
    expect(monitors[0]).not.toContain('noisy')
    expect(monitors[1]).toContain('noisy')
  })
  it('opens every Datadog link in a new tab without a referrer', async () => {
    const host = await render()
    const links = [...host.querySelectorAll('a')]
    expect(links.map(a => a.textContent)).toEqual(expect.arrayContaining(['svc-punch 5xx rate', 'Punch availability', 'Punch exports fail']))
    for (const link of links) {
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toBe('noreferrer')
    }
  })
  it('shows each SLO with its target and value', async () => {
    const host = await render()
    const slos = items(host, 'SLOs')
    expect(slos[0]).toContain('target 99.9 %')
    expect(slos[0]).toContain('99.95 %')
    expect(slos[1]).toContain('no value')
  })
  it('shows SLO figures to two decimals at most, never rounded up to a met target', async () => {
    const slos = [
      { id: 'c3', name: 'Punch uptime', target: 99.95, value: 99.99757641742285, url: 'https://app.datadoghq.eu/slo?slo_id=c3' },
      { id: 'd4', name: 'Punch exports', target: 99, value: 31.944444444443, url: 'https://app.datadoghq.eu/slo?slo_id=d4' },
    ]
    const host = await render({ health: serviceHealth({ slos }) })
    const [uptime, exports] = items(host, 'SLOs')
    expect(uptime).toContain('target 99.95 % · 99.99 %')
    expect(exports).toContain('target 99 % · 31.94 %')
  })
  it('lists the open incidents', async () => {
    const host = await render()
    expect(items(host, 'Incidents')[0]).toContain('SEV-2')
  })
  it('labels each release with its verdict', async () => {
    const host = await render()
    const releases = items(host, 'Releases')
    expect(releases[0]).toContain('Regressed')
    expect(releases[0]).toContain('feat: punch rounding')
    expect(releases[1]).toContain('Steady')
    expect(releases[2]).toContain('Too recent')
  })
  it('names each sparkline with its figures and the partial snapshot day', async () => {
    const host = await render()
    const names = [...host.querySelectorAll('svg[role="img"]')].map(svg => svg.getAttribute('aria-label'))
    expect(names).toEqual([
      'Requests, max 1130, last 1130; the last point is the snapshot day, partial',
      '5xx, max 13, last 13; the last point is the snapshot day, partial',
      'p95 ms, max 213, last 213; the last point is the snapshot day, partial',
    ])
    expect(host.textContent).toContain('the hollow last point is the snapshot day, partial')
    expect(host.textContent).not.toContain('today')
  })
  it('names a sparkline with no figures no data', async () => {
    const strip = serviceHealth().strip.map(d => ({ ...d, p95ms: null }))
    const host = await render({ health: serviceHealth({ strip }) })
    expect(host.querySelector('svg[aria-label^="p95 ms"]')?.getAttribute('aria-label')).toBe('p95 ms, no data')
  })
  it('leaves a gap in the line for a day without data', async () => {
    const host = await render()
    const lines = (name: string) => host.querySelectorAll(`svg[aria-label^="${name},"] polyline`).length
    expect(lines('Requests')).toBe(1)
    expect(lines('5xx')).toBe(2)
  })
  it('leaves out empty lists and the strip when Datadog has none', async () => {
    const host = await render({ health: serviceHealth({ state: 'noData', reasons: [], monitors: [], slos: [], incidents: [], releases: [], strip: [] }) })
    expect(host.querySelectorAll('section section')).toHaveLength(0)
    expect(host.querySelector('svg')).toBeNull()
  })
  it('signs the footer with the snapshot date', async () => {
    const host = await render()
    expect(host.querySelector('footer')?.textContent).toBe('Datadog snapshot of 2026-11-02')
  })
  it('marks a snapshot older than 7 days as stale', async () => {
    const host = await render({ snapshotDate: '2026-10-25' })
    expect(host.querySelector('footer')?.textContent).toContain('stale')
    const fresh = await render({ snapshotDate: '2026-10-27' })
    expect(fresh.querySelector('footer')?.textContent).not.toContain('stale')
  })
  it('marks a snapshot with an unreadable date as stale', async () => {
    const host = await render({ snapshotDate: 'not a date' })
    expect(host.querySelector('footer')?.textContent).toContain('stale')
  })
  it('warns that noisy counts may be low when the events were capped', async () => {
    const host = await render({ eventsCapped: true })
    expect(host.querySelector('footer')?.textContent).toContain('Noisy counts may be low')
  })
})
