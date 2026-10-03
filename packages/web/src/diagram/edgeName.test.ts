import { describe, it, expect } from 'vitest'
import { edgeName } from './edgeName'

describe('edgeName', () => {
  it('names an edge by its ends, its label and its condition', () => {
    expect(edgeName('svc-x', 'Calls · 1', { label: 'SQS ×2' })).toBe('svc-x → Calls · 1: SQS ×2')
    expect(edgeName('a', 'b', { label: 'run', condition: 'absence shifts only' })).toBe('a → b: run (if absence shifts only)')
  })
})
