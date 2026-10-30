import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NO_FOCUS } from './focus'
import type { DiagramModel } from './model'
import { Diagram } from './Diagram'

const model: DiagramModel = {
  id: 'm', title: 'A diagram', width: 300, height: 100, groups: [], edges: [],
  nodes: [{ id: 'a', kind: 'service', label: 'svc-a', detail: [], stores: [], fontSize: 12, x: 10, y: 10, w: 120, h: 29 }],
}
const noop = () => {}
const html = renderToStaticMarkup(<Diagram model={model} focus={NO_FOCUS} onSelect={noop} filename="m" notes={['a note']} />)

describe('Diagram', () => {
  it('offers both exports in a titled frame', () => {
    expect(html).toContain('aria-label="A diagram"')
    expect(html).toContain('Export PNG')
    expect(html).toContain('Export SVG')
  })
  it('explains line styles and extra notes in a legend', () => {
    expect(html).toContain('aria-label="Legend"')
    for (const text of ['sync', 'async', 'data feed', 'thicker = more connections', 'a note']) {
      expect(html, text).toContain(text)
    }
  })
})
