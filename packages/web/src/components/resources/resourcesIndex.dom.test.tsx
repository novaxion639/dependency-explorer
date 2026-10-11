// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { listenerMetrics, listenerSurface, resourceSurface } from '@dependency-explorer/data'
import { ResourcesIndex } from './ResourcesIndex'

const COUNTS = /^(\d+) listeners?( · \d+ also changes?)( · \d+ bypassing writes?)$/
const pgTables = resourceSurface.resources.filter(r => r.kind === 'table' && r.id.startsWith('pg:'))

function mount() {
  const host = document.createElement('div')
  act(() => {
    createRoot(host).render(<ResourcesIndex onOpenResource={() => {}} />)
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
