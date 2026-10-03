import { describe, it, expect } from 'vitest'
import { connectivityMap, resourceSurface } from '@dependency-explorer/data'
import { buildSearchIndex } from './searchIndex'

describe('buildSearchIndex', () => {
  it('lands every result on a clean view — no blast radius or code detail carried over', () => {
    for (const entry of buildSearchIndex(connectivityMap)) {
      expect(entry.patch.blast, `${entry.type} ${entry.label}`).toBeNull()
      expect(entry.patch.detail, `${entry.type} ${entry.label}`).toBeNull()
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
