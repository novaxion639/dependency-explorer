// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { HealthSection } from './HealthSection'
import { serviceHealth } from './overlayFixture'

const NOW = new Date('2026-11-02T12:00:00Z')

const renderHealth = (props: Partial<Parameters<typeof HealthSection>[0]> = {}) =>
  render(<HealthSection health={serviceHealth()} snapshotDate="2026-11-02" eventsCapped={false} now={NOW} {...props} />)

const items = (label: string) =>
  within(screen.getByRole('region', { name: label })).getAllByRole('listitem').map(li => li.textContent)

const footer = () => screen.getByText(/^Datadog snapshot of/).textContent

describe('HealthSection', () => {
  it('heads the section Health', () => {
    renderHealth()

    expect(screen.getByRole('heading', { name: 'Health' })).toBeTruthy()
  })

  it('states the problem with its reason', () => {
    renderHealth()

    expect(screen.getByText('Problem now')).toBeTruthy()
    expect(screen.getByText('5xx 4.1× (+63) over 72 h', { exact: false })).toBeTruthy()
  })

  it.each([
    ['dig', 'To dig into'],
    ['fellBack', 'Fell back'],
    ['healthy', 'Healthy'],
    ['noData', 'No data'],
  ] as const)('names the %s state', (state, label) => {
    renderHealth({ health: serviceHealth({ state, reasons: [] }) })

    expect(screen.getByText(label)).toBeTruthy()
  })

  it('lists the monitors', () => {
    renderHealth()

    const monitors = items('Monitors')
    expect(monitors).toHaveLength(2)
    expect(monitors[0]).toContain('svc-punch 5xx rate')
  })

  it('marks only the noisy monitor', () => {
    renderHealth()

    const [quiet, noisy] = items('Monitors')
    expect(quiet).not.toContain('noisy')
    expect(noisy).toContain('noisy')
  })

  it('links the monitors, SLOs and incidents to Datadog', () => {
    renderHealth()

    expect(screen.getAllByRole('link').map(a => a.textContent)).toEqual(expect.arrayContaining(['svc-punch 5xx rate', 'Punch availability', 'Punch exports fail']))
  })

  it('opens every Datadog link in a new tab without a referrer', () => {
    renderHealth()

    const targets = screen.getAllByRole('link').map(a => `${a.getAttribute('target')} ${a.getAttribute('rel')}`)
    expect(new Set(targets)).toEqual(new Set(['_blank noreferrer']))
  })

  it('shows each SLO with its target and value', () => {
    renderHealth()

    const [withValue, withoutValue] = items('SLOs')
    expect(withValue).toContain('target 99.9 %')
    expect(withValue).toContain('99.95 %')
    expect(withoutValue).toContain('no value')
  })

  it('shows SLO figures to two decimals at most, never rounded up to a met target', () => {
    const slos = [
      { id: 'c3', name: 'Punch uptime', target: 99.95, value: 99.99757641742285, url: 'https://app.datadoghq.eu/slo?slo_id=c3' },
      { id: 'd4', name: 'Punch exports', target: 99, value: 31.944444444443, url: 'https://app.datadoghq.eu/slo?slo_id=d4' },
    ]
    renderHealth({ health: serviceHealth({ slos }) })

    const [uptime, exports] = items('SLOs')
    expect(uptime).toContain('target 99.95 % · 99.99 %')
    expect(exports).toContain('target 99 % · 31.94 %')
  })

  it('lists the open incidents', () => {
    renderHealth()

    expect(items('Incidents')[0]).toContain('SEV-2')
  })

  it('labels each release with its verdict', () => {
    renderHealth()

    const [regressed, steady, tooRecent] = items('Releases')
    expect(regressed).toContain('Regressed')
    expect(regressed).toContain('feat: punch rounding')
    expect(steady).toContain('Steady')
    expect(tooRecent).toContain('Too recent')
  })

  it('dates a release by its Paris day, as the Delivery section does', () => {
    const lateNight = serviceHealth({ releases: [{ sha: 'abcdef1234567', title: 'feat: late merge', mergedAt: '2026-11-09T23:30:00Z', verdict: 'steady' }] })
    renderHealth({ health: lateNight })

    expect(items('Releases')[0]).toContain('10 Nov')
  })

  it('names each sparkline with its figures and the partial snapshot day', () => {
    renderHealth()

    expect(screen.getAllByRole('img').map(svg => svg.getAttribute('aria-label'))).toEqual([
      'Requests, max 1130, last 1130; the last point is the snapshot day, partial',
      '5xx, max 13, last 13; the last point is the snapshot day, partial',
      'p95 ms, max 213, last 213; the last point is the snapshot day, partial',
    ])
  })

  it('explains the hollow last point as the partial snapshot day', () => {
    renderHealth()

    expect(screen.getByText(/the hollow last point is the snapshot day, partial/)).toBeTruthy()
  })

  it('never calls the snapshot day today', () => {
    renderHealth()

    expect(screen.getByRole('region', { name: 'Health' }).textContent).not.toContain('today')
  })

  it('names a sparkline with no figures no data', () => {
    const strip = serviceHealth().strip.map(d => ({ ...d, p95ms: null }))
    renderHealth({ health: serviceHealth({ strip }) })

    expect(screen.getByRole('img', { name: /^p95 ms/ }).getAttribute('aria-label')).toBe('p95 ms, no data')
  })

  it.each([
    ['Requests', 1],
    ['5xx', 2],
  ])('draws the %s line in %i run(s), with a gap for a day without data', (name, runs) => {
    renderHealth()

    expect(screen.getByRole('img', { name: new RegExp(`^${name},`) }).querySelectorAll('polyline')).toHaveLength(runs)
  })

  it('leaves out every list when Datadog has none', () => {
    renderHealth({ health: serviceHealth({ state: 'noData', reasons: [], monitors: [], slos: [], incidents: [], releases: [], strip: [] }) })

    expect(screen.getAllByRole('region').map(r => r.getAttribute('aria-label'))).toEqual(['Health'])
    expect(screen.queryAllByRole('list')).toHaveLength(0)
  })

  it('leaves out the strip when Datadog has none', () => {
    renderHealth({ health: serviceHealth({ strip: [] }) })

    expect(screen.queryAllByRole('img')).toHaveLength(0)
  })

  it('signs the footer with the snapshot date', () => {
    renderHealth()

    expect(footer()).toBe('Datadog snapshot of 2026-11-02')
  })

  it('marks a snapshot older than 7 days as stale', () => {
    renderHealth({ snapshotDate: '2026-10-25' })

    expect(footer()).toContain('stale')
  })

  it('keeps a 6-day-old snapshot fresh', () => {
    renderHealth({ snapshotDate: '2026-10-27' })

    expect(footer()).not.toContain('stale')
  })

  it('marks a snapshot with an unreadable date as stale', () => {
    renderHealth({ snapshotDate: 'not a date' })

    expect(footer()).toContain('stale')
  })

  it('warns that noisy counts may be low when the events were capped', () => {
    renderHealth({ eventsCapped: true })

    expect(footer()).toContain('Noisy counts may be low')
  })
})
