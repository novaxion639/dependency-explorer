import { describe, expect, it } from 'vitest'
import { getOrCreate } from './collections'

describe('getOrCreate', () => {
  it('stores the created value once and returns the stored one afterwards', () => {
    const map = new Map<string, string[]>()

    getOrCreate(map, 'a', () => []).push('x')
    getOrCreate(map, 'a', () => ['unused']).push('y')

    expect(map.get('a')).toEqual(['x', 'y'])
  })
})
