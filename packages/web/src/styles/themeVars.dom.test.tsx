// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SkThemeProvider } from '@skelloapp/skello-ds-web'
import { ThemeVars } from './themeVars'

const BRIDGED = ['--paper', '--paper-2', '--card', '--ink', '--ink-muted', '--ink-faint', '--rule', '--rule-strong', '--highlight', '--fails', '--starves', '--degrades', '--ok', '--font-sans', '--text-xs', '--text-sm', '--text-md', '--text-lg', '--text-xl', '--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6', '--radius-sm', '--radius-md', '--radius-lg']

const rootToken = (token: string): string => getComputedStyle(document.documentElement).getPropertyValue(token).trim()

describe('ThemeVars', () => {
  it.each(BRIDGED)('defines %s on :root from the DS theme', token => {
    render(<SkThemeProvider isScoped><ThemeVars /></SkThemeProvider>)

    const value = rootToken(token)

    expect(value).toBeTruthy()
    expect(value).not.toContain('undefined')
  })

  it('sizes type in px so present mode can override it in CSS', () => {
    render(<SkThemeProvider isScoped><ThemeVars /></SkThemeProvider>)

    expect(rootToken('--text-md')).toMatch(/^\d+px$/)
  })
})
