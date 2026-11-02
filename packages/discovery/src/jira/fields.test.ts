import { describe, expect, it } from 'vitest'
import { isOpenBug } from './fields'

const bug = (status: string, statusCategory: 'new' | 'indeterminate' | 'done' | 'undefined') => ({ status, statusCategory })

describe('isOpenBug', () => {
  const site = new Set(['To Do', 'QA', 'Go for MEP', 'Done'])

  it('counts every bug outside the done category', () => {
    expect(isOpenBug(bug('To Do', 'new'), site)).toBe(true)
    expect(isOpenBug(bug('In Progress', 'indeterminate'), site)).toBe(true)
    expect(isOpenBug(bug('Weird', 'undefined'), site)).toBe(true)
  })

  it('counts a to-ship status in the done category when the site has it', () => {
    expect(isOpenBug(bug('QA', 'done'), site)).toBe(true)
    expect(isOpenBug(bug('Go for MEP', 'done'), ['Go for MEP'])).toBe(true)
  })

  it('does not count a done bug, nor a to-ship status the site lacks', () => {
    expect(isOpenBug(bug('Done', 'done'), site)).toBe(false)
    expect(isOpenBug(bug('QA', 'done'), new Set(['Done']))).toBe(false)
  })
})
