import { describe, it, expect } from 'vitest'
import { presentKeyAction } from './presentMode'

const key = (k: string, over: Partial<Parameters<typeof presentKeyAction>[0]> = {}) => ({ key: k, metaKey: false, ctrlKey: false, altKey: false, targetTag: 'BODY', targetEditable: false, ...over })

describe('presentKeyAction', () => {
  it('toggles on P and exits on Escape', () => {
    expect(presentKeyAction(key('p'), false)).toBe('toggle')
    expect(presentKeyAction(key('P'), true)).toBe('toggle')
    expect(presentKeyAction(key('Escape'), true)).toBe('exit')
    expect(presentKeyAction(key('Escape'), false)).toBeNull()
  })
  it('ignores keys typed into fields', () => {
    expect(presentKeyAction(key('p', { targetTag: 'INPUT' }), false)).toBeNull()
    expect(presentKeyAction(key('p', { targetTag: 'TEXTAREA' }), false)).toBeNull()
    expect(presentKeyAction(key('p', { targetEditable: true }), false)).toBeNull()
    expect(presentKeyAction(key('Escape', { targetTag: 'INPUT' }), true)).toBeNull()
  })
  it('ignores P with a modifier', () => {
    expect(presentKeyAction(key('p', { metaKey: true }), false)).toBeNull()
    expect(presentKeyAction(key('p', { ctrlKey: true }), false)).toBeNull()
  })
})
