import { describe, it, expect } from 'vitest'
import { plural } from './plural'

describe('plural', () => {
  it('pluralises every count but one', () => {
    expect([plural(0, 'flow'), plural(1, 'flow'), plural(2, 'file')]).toEqual(['0 flows', '1 flow', '2 files'])
  })
})
