import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const theme = readFileSync(new URL('./theme.css', import.meta.url), 'utf-8')
const base = readFileSync(new URL('../index.css', import.meta.url), 'utf-8')

const TOKENS = ['--paper', '--paper-2', '--card', '--ink', '--ink-muted', '--ink-faint', '--rule', '--rule-strong', '--highlight', '--fails', '--starves', '--degrades', '--ok', '--font-sans', '--text-xs', '--text-sm', '--text-md', '--text-lg', '--text-xl', '--space-1', '--space-6', '--radius-md', '--line', '--rail-width', '--panel-width']

describe('Paper theme', () => {
  it('defines every token on :root', () => {
    for (const token of TOKENS) {
      expect(theme, token).toMatch(new RegExp(`${token}\\s*:`))
    }
  })
  it('scales the type set in present mode', () => {
    expect(theme).toMatch(/\[data-present='true'\]\s*\{[^}]*--text-md/)
  })
  it('paints the page in Paper with no dark palette left', () => {
    expect(base).toMatch(/body\s*\{[^}]*background:\s*var\(--paper\)/)
    expect(base).not.toMatch(/legacy-canvas|#0f1117/)
  })
})
