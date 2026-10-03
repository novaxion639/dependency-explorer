import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('./flows.module.css', import.meta.url), 'utf-8')
const wide = css.slice(css.indexOf('@media (min-width: 768px)'))
const narrow = css.slice(css.indexOf('@media (max-width: 767px)'), css.indexOf('@media (min-width: 768px)'))

describe('flow page layout', () => {
  it('fits the story to the screen on wide screens, scrolling the chapters beside a full-height diagram', () => {
    expect(wide).toMatch(/\.page:has\(> \.story\)\s*\{[^}]*min-height:\s*0/)
    expect(wide).toMatch(/\.story\s*\{[^}]*grid-template-rows:\s*minmax\(0, 1fr\)/)
    expect(wide).toMatch(/\.chapters\s*\{[^}]*overflow-y:\s*auto/)
    expect(wide).toMatch(/\.storyDiagram\s*\{[^}]*--canvas-min:\s*360px/)
  })
  it('lets the diagram column shrink to the screen, so nothing scrolls sideways', () => {
    expect(css).toMatch(/\.story\s*\{[^}]*grid-template-columns:\s*minmax\(240px, 320px\) minmax\(0, 1fr\)/)
    expect(narrow).toMatch(/\.story\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/)
    expect(css).toMatch(/\.storyDiagram\s*\{[^}]*flex-direction:\s*column/)
  })
})
