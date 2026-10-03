import { describe, it, expect } from 'vitest'

const sources = import.meta.glob<string>(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}'], { query: '?raw', import: 'default', eager: true })
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\(/

describe('inline colour literals', () => {
  it('appear nowhere in the web source', () => {
    expect(Object.entries(sources).filter(([, src]) => COLOUR_LITERAL.test(src)).map(([path]) => path.replace(/^\.\.\//, '')).sort()).toEqual([])
  })
})
