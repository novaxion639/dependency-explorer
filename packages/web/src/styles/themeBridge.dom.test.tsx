// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SkThemeProvider, useTheme } from '@skelloapp/skello-ds-web'
import { ThemeBridge } from './ThemeBridge'

const BRIDGED = ['--paper', '--paper-2', '--card', '--ink', '--ink-muted', '--ink-faint', '--rule', '--rule-strong', '--highlight', '--fails', '--starves', '--degrades', '--ok', '--font-sans', '--text-xs', '--text-sm', '--text-md', '--text-lg', '--text-xl', '--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6', '--radius-sm', '--radius-md', '--radius-lg', '--weight-regular', '--weight-semibold', '--z-drawer']

const rootToken = (token: string): string => getComputedStyle(document.documentElement).getPropertyValue(token).trim()

function TextMSize() {
  return <output>{String(useTheme().typography.textM.fontSize)}</output>
}

describe('ThemeBridge', () => {
  it.each(BRIDGED)('defines %s on :root from the DS theme', token => {
    render(<SkThemeProvider isScoped><ThemeBridge>{null}</ThemeBridge></SkThemeProvider>)

    const value = rootToken(token)

    expect(value).toBeTruthy()
    expect(value).not.toContain('undefined')
  })

  it('sizes type in px so present mode can override it in CSS', () => {
    render(<SkThemeProvider isScoped><ThemeBridge>{null}</ThemeBridge></SkThemeProvider>)

    expect(rootToken('--text-md')).toMatch(/^\d+px$/)
  })

  it('sizes DS typography from the type tokens, so DS components follow present mode', () => {
    const { getByRole } = render(<SkThemeProvider isScoped><ThemeBridge><TextMSize /></ThemeBridge></SkThemeProvider>)

    expect(getByRole('status').textContent).toBe('var(--text-md)')
  })
})
