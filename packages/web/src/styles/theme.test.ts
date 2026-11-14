import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const theme = readFileSync(new URL('./theme.css', import.meta.url), 'utf-8')
const base = readFileSync(new URL('../index.css', import.meta.url), 'utf-8')

describe('app theme', () => {
  it.each(['--font-mono', '--line', '--rail-width', '--panel-width'])('defines the app-only token %s on :root', token => {
    expect(theme).toMatch(new RegExp(`${token}\\s*:`))
  })

  it('scales the type set in present mode', () => {
    expect(theme).toMatch(/\[data-present='true'\]\s*\{[^}]*--text-md/)
  })

  it('outlines keyboard focus, which the DS buttons do not draw', () => {
    expect(base).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid/)
  })

  it('paints the page from the theme background', () => {
    expect(base).toMatch(/body\s*\{[^}]*background:\s*var\(--paper\)/)
  })
})
