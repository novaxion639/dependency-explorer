import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('./flows.module.css', import.meta.url), 'utf-8')
const wide = css.slice(css.indexOf('@media (min-width: 768px)'))

describe('flow page layout', () => {
  it('fits the story to the screen on wide screens, scrolling the chapters beside a full-height diagram', () => {
    expect(wide).toMatch(/\.page:has\(> \.story\)\s*\{[^}]*min-height:\s*0/)
    expect(wide).toMatch(/\.story\s*\{[^}]*grid-template-rows:\s*minmax\(0, 1fr\)/)
    expect(wide).toMatch(/\.chapters\s*\{[^}]*overflow-y:\s*auto/)
    expect(wide).toMatch(/\.storyDiagram\s*\{[^}]*--canvas-min:\s*360px/)
  })
})
