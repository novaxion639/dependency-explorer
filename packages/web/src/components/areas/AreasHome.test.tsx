import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { connectivityMap, getSharedExternals } from '@dependency-explorer/data'
import { AreasHome } from './AreasHome'

describe('AreasHome', () => {
  it('lists the external systems every area shares, with the repos using them', () => {
    const shared = getSharedExternals(connectivityMap.areas ?? [], connectivityMap.externals ?? [])
    expect(shared.length).toBeGreaterThan(0)
    const html = renderToStaticMarkup(<AreasHome map={connectivityMap} onOpenArea={() => {}} onOpenContext={() => {}} />)
    expect(html).toContain('Shared by every area')
    for (const e of shared) {
      expect(html).toContain(e.name)
    }
  })
})
