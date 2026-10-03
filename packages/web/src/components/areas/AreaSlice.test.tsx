import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { connectivityMap as map, monolithRoutes, resourceSurface } from '@dependency-explorer/data'
import { areaSlice } from '../../utils/areaSlice'
import { AreaSlice } from './AreaSlice'

const noop = () => {}

describe('AreaSlice', () => {
  it('shows the slice of an area in the panel', () => {
    const slice = areaSlice(map, monolithRoutes, resourceSurface.resources, 'planning')
    if (!slice) {
      throw new Error('planning slice missing')
    }
    const html = renderToStaticMarkup(<AreaSlice slice={slice} onOpenArea={noop} onOpenResource={noop} onSelectService={noop} onOpenFlow={noop} onClose={noop} />)
    expect(html).toContain('aria-label="Planning slice"')
    for (const text of ['Controllers · ', 'Tables · ', 'Services it calls · ', 'Flows · ', '>shifts</button>', 'Shift Creation', 'Open the area page →']) {
      expect(html, text).toContain(text)
    }
  })
})
