import { describe, it, expect } from 'vitest'
import { checkUnitPaths } from './unit-paths'

describe('checkUnitPaths', () => {
  it('reports missing paths and counts units it could not check', () => {
    const units = [
      { flow: 'f', id: 'u1', service: 'svc-a', path: 'src/a.ts' },
      { flow: 'f', id: 'u2', service: 'svc-a', path: 'src/gone.ts' },
      { flow: 'f', id: 'u3', service: 'svc-b', path: 'src/b.ts' },
      { flow: 'f', id: 'u4', service: 'svc-c', path: 'src/c.ts' },
      { flow: 'f', id: 'u5', service: 'svc-a' },
    ]
    const result = checkUnitPaths(units, s => (s === 'svc-c' ? undefined : '1234567890'), s => s !== 'svc-b', () => true, (_s, _sha, file) => file !== 'src/gone.ts')
    expect(result).toEqual({ missing: ['f u2 svc-a@1234567 src/gone.ts'], skipped: 2 })
  })

  it('skips the units of a repo whose clone lacks the pinned commit, rather than calling them missing', () => {
    const units = [
      { flow: 'f', id: 'u1', service: 'svc-a', path: 'src/a.ts' },
      { flow: 'f', id: 'u2', service: 'svc-a', path: 'src/b.ts' },
    ]
    const result = checkUnitPaths(units, () => 'newpin00000', () => true, (_s, sha) => sha !== 'newpin00000', () => false)
    expect(result).toEqual({ missing: [], skipped: 2 })
  })
})
