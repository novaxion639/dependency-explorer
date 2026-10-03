import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('./AppShell.module.css', import.meta.url), 'utf-8')
const mobile = css.slice(css.indexOf('@media'))

describe('AppShell layout', () => {
  it('sizes body text from the token so present mode scales it', () => {
    expect(css).toMatch(/\.shell\s*\{[^}]*font-size:\s*var\(--text-md\)/)
  })
  it('scrolls content and panel together on narrow screens, under a fixed rail layer', () => {
    expect(mobile).toMatch(/\.content\s*\{[^}]*overflow-y:\s*auto/)
    expect(mobile).not.toMatch(/\.body\s*\{[^}]*overflow-y:\s*auto/)
  })
  it('opens the mobile rail inside the body, above the canvas, never over the header', () => {
    expect(css).toMatch(/\.body\s*\{[^}]*position:\s*relative/)
    expect(mobile).toMatch(/\.railSlot\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/)
    expect(mobile).not.toMatch(/inset:\s*49px/)
  })
})
