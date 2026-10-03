import { describe, it, expect } from 'vitest'
import { presentKeyAction, onPresentKey, presentStepKey, stepThrough } from './presentMode'

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

describe('onPresentKey', () => {
  it('exits present mode and stops the Escape from also closing the page beneath', () => {
    const patches: unknown[] = []
    let stopped = false
    onPresentKey({ ...key('Escape'), stopPropagation: () => { stopped = true } }, true, p => { patches.push(p) })
    expect(patches).toEqual([{ present: false }])
    expect(stopped).toBe(true)
  })
  it('lets an Escape through when not presenting', () => {
    let stopped = false
    onPresentKey({ ...key('Escape'), stopPropagation: () => { stopped = true } }, false, () => {})
    expect(stopped).toBe(false)
  })
})

describe('presentStepKey', () => {
  it('steps forward and back with the arrow keys', () => {
    expect([presentStepKey(key('ArrowRight')), presentStepKey(key('ArrowDown'))]).toEqual(['next', 'next'])
    expect([presentStepKey(key('ArrowLeft')), presentStepKey(key('ArrowUp'))]).toEqual(['prev', 'prev'])
    expect(presentStepKey(key('a'))).toBeNull()
  })
  it('ignores arrows typed into fields or with a modifier', () => {
    expect(presentStepKey(key('ArrowRight', { targetTag: 'INPUT' }))).toBeNull()
    expect(presentStepKey(key('ArrowRight', { altKey: true }))).toBeNull()
  })
})

describe('stepThrough', () => {
  const ids = ['a', 'b', 'c']
  it('starts at either end and wraps around', () => {
    expect([stepThrough(ids, null, 'next'), stepThrough(ids, null, 'prev')]).toEqual(['a', 'c'])
    expect([stepThrough(ids, 'a', 'next'), stepThrough(ids, 'c', 'next'), stepThrough(ids, 'a', 'prev')]).toEqual(['b', 'a', 'c'])
    expect(stepThrough(ids, 'gone', 'next')).toBe('a')
    expect(stepThrough([], null, 'next')).toBeNull()
  })
})
