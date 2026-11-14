// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { act, screen, within } from '@testing-library/react'
import { renderInApp } from '../test/renderInApp'
import { map } from './dataIndexes'
import { Explorer } from './Explorer'

const servicesWithEndpoints = () => {
  const [first, second] = map.services.filter(s => s.endpoints.length > 1 && s.name !== 'skello-app')
  if (!first || !second) {
    throw new Error('the dataset needs two services with endpoints')
  }
  return { first, second }
}

const drawerQs = (name: string) => `?page=microservices&s=${name}&drawer=${name}`

const openRow = () => within(screen.getByRole('article', { name: 'Endpoints' })).getByRole('button', { expanded: true }).textContent

const renderExplorerAt = (name: string) => {
  window.history.replaceState(null, '', `/${drawerQs(name)}`)
  renderInApp(<Explorer />, drawerQs(name))
}

const scrollIntoView = Element.prototype.scrollIntoView

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})

afterEach(() => {
  Element.prototype.scrollIntoView = scrollIntoView
  vi.unstubAllGlobals()
})

describe('endpoint drawer', () => {
  it('opens the first endpoint of the drawer service', () => {
    const { first } = servicesWithEndpoints()

    renderExplorerAt(first.name)

    expect(openRow()).toContain(first.endpoints[0]?.path ?? '')
  })

  it('opens the first endpoint of the new service when the drawer switches service', () => {
    const { first, second } = servicesWithEndpoints()
    renderExplorerAt(first.name)

    act(() => {
      window.history.pushState(null, '', `/${drawerQs(second.name)}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(openRow()).toContain(second.endpoints[0]?.path ?? '')
  })
})
