import { describe, it, expect } from 'vitest'
import { connectivityMap, listenerSurface, resourceSurface } from '@dependency-explorer/data'
import { buildSearchIndex } from './searchIndex'

describe('buildSearchIndex', () => {
  it('lands every result on a clean view — no blast radius or code detail carried over', () => {
    for (const entry of buildSearchIndex(connectivityMap)) {
      expect(entry.patch.blast, `${entry.type} ${entry.label}`).toBeNull()
      expect(entry.patch.unit, `${entry.type} ${entry.label}`).toBeNull()
    }
  })
})

describe('resource entries', () => {
  it('index every registry resource and replace the old infra entries', () => {
    const entries = buildSearchIndex(connectivityMap, [], resourceSurface.resources)
    const shifts = entries.find(e => e.type === 'resource' && e.label === 'shifts')
    expect(shifts?.patch.resource).toBe('pg:skello_production.shifts')
    expect(entries.filter(e => e.type === 'resource')).toHaveLength(resourceSurface.resources.length)
    expect(entries.some(e => String(e.type) === 'infra')).toBe(false)
  })
})

describe('pages', () => {
  const index = buildSearchIndex(connectivityMap, [], resourceSurface.resources)
  it('gives every result a page', () => {
    for (const entry of index) {
      expect(entry.patch.page, `${entry.type} ${entry.label}`).toBeDefined()
    }
  })
})

describe('listener entries', () => {
  it('finds a listener method and an enqueued job, landing on the table with the row open', () => {
    const index = buildSearchIndex(connectivityMap, [], resourceSurface.resources, listenerSurface.listeners)
    const method = index.find(e => e.type === 'listener' && e.label === 'update_paid_leaves')
    expect(method?.patch).toMatchObject({ page: 'resources', resource: 'pg:skello_production.shifts', listener: 'shifts.after_commit.update_paid_leaves' })
    expect(index.some(e => e.type === 'listener' && e.label === 'ShiftCallbackJob')).toBe(true)
  })
  it('gives a job one entry per enqueuing listener', () => {
    const index = buildSearchIndex(connectivityMap, [], resourceSurface.resources, listenerSurface.listeners)
    const entries = index.filter(e => e.type === 'listener' && e.label === 'Billing::ThirdPartySyncJob')
    expect(entries.map(e => e.patch.listener).sort()).toEqual(listenerSurface.listeners.filter(l => l.effects.some(e => e.kind === 'enqueues' && e.target === 'Billing::ThirdPartySyncJob')).map(l => l.id).sort())
    expect(entries.length).toBeGreaterThan(1)
  })
})
