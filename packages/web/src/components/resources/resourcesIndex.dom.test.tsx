// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { listenerMetrics, listenerSurface, resourceSurface } from '@dependency-explorer/data'
import { parseUrl } from '../../hooks/useUrlState'
import { ResourcesIndex } from './ResourcesIndex'

const COUNTS = /^(\d+) listeners?( · \d+ also changes?)( · \d+ bypassing writes?)$/
const pgTables = resourceSurface.resources.filter(r => r.kind === 'table' && r.id.startsWith('pg:'))

function mount(search = '?page=resources') {
  const host = document.createElement('div')
  act(() => {
    createRoot(host).render(<ResourcesIndex url={parseUrl(search)} patch={() => {}} onOpenResource={() => {}} />)
  })
  return host
}

const counts = (host: HTMLElement) => [...host.querySelectorAll('button small')].map(s => s.textContent ?? '').filter(t => t.includes('bypassing'))

describe('ResourcesIndex cards', () => {
  it('shows listener, also-changes and bypassing counts on every pg table card', () => {
    expect(counts(mount())).toHaveLength(pgTables.length)
  })
  it('shows zeros for a table with no listener and no write site', () => {
    const metrics = listenerMetrics(listenerSurface)
    expect(pgTables.some(r => !metrics.has(r.id))).toBe(true)
    expect(counts(mount())).toContain('0 listeners · 0 also changes · 0 bypassing writes')
  })
  it('pluralises each count', () => {
    expect(counts(mount()).every(t => COUNTS.test(t))).toBe(true)
    expect(counts(mount()).some(t => t.startsWith('1 listener ·'))).toBe(true)
  })
})

describe('ResourcesIndex filters', () => {
  it('reads its filters from the URL, so Back restores them', () => {
    const host = mount('?page=resources&rkind=queue')
    expect(host.querySelector<HTMLSelectElement>('select[aria-label="Kind"]')?.value).toBe('queue')
    expect(counts(host)).toHaveLength(0)
  })

  it('writes a changed filter to the URL', () => {
    const patches: unknown[] = []
    const host = document.createElement('div')
    act(() => {
      createRoot(host).render(<ResourcesIndex url={parseUrl('?page=resources')} patch={p => patches.push(p)} onOpenResource={() => {}} />)
    })
    const cycles = [...host.querySelectorAll('label')].find(l => l.textContent?.includes('Cycles only'))?.querySelector('input')
    act(() => cycles?.click())
    expect(patches).toEqual([{ cycles: true }])
  })
})
