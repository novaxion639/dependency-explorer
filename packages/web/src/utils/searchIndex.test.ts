import { describe, it, expect } from 'vitest'
import { connectivityMap } from '@dependency-explorer/data'
import { buildSearchIndex } from './searchIndex'

describe('buildSearchIndex', () => {
  it('lands every result on a clean view — no blast radius or code detail carried over', () => {
    for (const entry of buildSearchIndex(connectivityMap)) {
      expect(entry.patch.blast, `${entry.type} ${entry.label}`).toBe(false)
      expect(entry.patch.detail, `${entry.type} ${entry.label}`).toBeNull()
    }
  })
})
