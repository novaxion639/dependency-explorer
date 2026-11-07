// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { byRole } from '../test/roles'
import { Sparkline } from './Sparkline'

const roots: Root[] = []

const render = async (partialNote: string | null) => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div')
  const root = createRoot(host)
  roots.push(root)
  await act(async () => root.render(<Sparkline label="Count" values={[1, null, 3, 2]} partialNote={partialNote} />))
  return byRole(host, 'img', /^Count/)
}

afterEach(async () => {
  await act(async () => roots.splice(0).forEach(r => r.unmount()))
})

describe('Sparkline', () => {
  it('draws every point on the line without a partial note', async () => {
    const spark = await render(null)
    expect(spark?.getAttribute('aria-label')).toBe('Count, max 3, last 2')
    expect([...(spark?.querySelectorAll('polyline') ?? [])].map(p => p.getAttribute('points')?.split(' ').length)).toEqual([1, 2])
    expect(spark?.querySelectorAll('circle')).toHaveLength(0)
  })
  it('draws the last point hollow and names the partial note', async () => {
    const spark = await render('the last point is partial')
    expect(spark?.getAttribute('aria-label')).toBe('Count, max 3, last 2; the last point is partial')
    expect([...(spark?.querySelectorAll('polyline') ?? [])].map(p => p.getAttribute('points')?.split(' ').length)).toEqual([1, 1])
    expect(spark?.querySelectorAll('circle')).toHaveLength(1)
  })
})
