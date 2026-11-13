import { describe, expect, it } from 'vitest'
import { shortDay } from './shortDay'

describe('shortDay', () => {
  it('names the Paris day of an instant', () => {
    expect(shortDay('2026-11-09T23:30:00Z')).toBe('10 Nov')
  })

  it('returns a value that is not a date as it is', () => {
    expect(shortDay('soon')).toBe('soon')
  })
})
