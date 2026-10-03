import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('./Diagram.module.css', import.meta.url), 'utf-8')

describe('Diagram layout', () => {
  it('never shrinks below its canvas and legend, so content after it cannot overlap', () => {
    expect(css).toMatch(/\.frame\s*\{[^}]*flex:\s*1 0 auto/)
    expect(css).not.toMatch(/\.frame\s*\{[^}]*min-height:\s*0/)
  })
})
