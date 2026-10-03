// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { pagePatch, type UrlState } from '../hooks/useUrlState'
import { Breadcrumb } from './Breadcrumb'

describe('Breadcrumb in the browser', () => {
  it('pushes a history entry for every crumb click', async () => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    const calls: Array<[Partial<UrlState>, { push?: boolean } | undefined]> = []
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(<Breadcrumb crumbs={[{ label: 'Flows', patch: pagePatch('flows') }, { label: 'Shift Creation', patch: null }]} onNavigate={(p, o) => calls.push([p, o])} />))
    const button = [...host.querySelectorAll('button')].find(b => b.textContent === 'Flows')
    await act(async () => button?.click())
    expect(calls).toEqual([[pagePatch('flows'), { push: true }]])
    expect(host.querySelector('[aria-current="page"]')?.textContent).toBe('Shift Creation')
    root.unmount()
  })
})
