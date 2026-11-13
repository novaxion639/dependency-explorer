// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { map } from './dataIndexes'
import { Explorer } from './Explorer'

const openRow = (host: HTMLElement) => host.querySelector('[aria-label="Endpoints"] [aria-expanded="true"]')?.textContent ?? null

describe('endpoint drawer', () => {
  it('opens the first endpoint of the new service when the drawer switches service', async () => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    const scrollIntoView = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = () => {}
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
    const [first, second] = map.services.filter(s => s.endpoints.length > 1 && s.name !== 'skello-app')
    if (!first || !second) {
      throw new Error('the dataset needs two services with endpoints')
    }
    window.history.replaceState(null, '', `/?page=microservices&s=${first.name}&drawer=${first.name}`)
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(<Explorer />))
    expect(openRow(host)).toContain(first.endpoints[0]?.path ?? '')

    await act(async () => {
      window.history.pushState(null, '', `/?page=microservices&s=${second.name}&drawer=${second.name}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(openRow(host)).toContain(second.endpoints[0]?.path ?? '')
    await act(async () => root.unmount())
    Element.prototype.scrollIntoView = scrollIntoView
  })
})
