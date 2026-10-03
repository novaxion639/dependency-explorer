import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { connectivityMap, monolithRoutes, resourceSurface } from '@dependency-explorer/data'
import { buildSearchIndex } from '../utils/searchIndex'
import { HOME_TILES } from './home'
import { pagePatch } from '../hooks/useUrlState'
import { HomePage } from './HomePage'

describe('HomePage', () => {
  const html = renderToStaticMarkup(<HomePage index={buildSearchIndex(connectivityMap, monolithRoutes, resourceSurface.resources)} onNavigate={() => {}} />)
  it('asks the question and offers the four entry tiles', () => {
    expect(html).toContain('aria-label="What do you want to know?"')
    for (const title of ['The monolith', 'The microservices', 'Key flows', 'Change impact']) {
      expect(html, title).toContain(title)
    }
  })
  it('sends each tile to the top level of its module', () => {
    expect(HOME_TILES.map(t => t.patch)).toEqual([pagePatch('monolith'), pagePatch('microservices'), pagePatch('flows'), pagePatch('impact')])
  })
})
