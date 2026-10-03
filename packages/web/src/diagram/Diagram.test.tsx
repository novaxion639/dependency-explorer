import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NO_FOCUS } from './focus'
import type { DiagramModel, Renderer } from './model'
import { Diagram } from './Diagram'

const model = (renderers: Renderer[]): DiagramModel => ({
  id: 'm', title: 'A diagram', width: 300, height: 100, renderers, groups: [], edges: [],
  nodes: [{ id: 'a', kind: 'service', label: 'svc-a', detail: [], stores: [], fontSize: 12, x: 10, y: 10, w: 120, h: 29 }],
})
const noop = () => {}
const render = (renderers: Renderer[], renderer: Renderer) => renderToStaticMarkup(
  <Diagram model={model(renderers)} focus={NO_FOCUS} renderer={renderer} onRenderer={noop} onSelect={noop} filename="m" notes={['a note']} />,
)

describe('Diagram', () => {
  it('offers every renderer the model supports and checks the active one', () => {
    const html = render(['react-flow', 'svg', 'mermaid'], 'svg')
    expect(html).toContain('role="radiogroup" aria-label="Renderer"')
    expect(html).toMatch(/role="radio" aria-checked="true"[^>]*>SVG</)
    expect(html).toContain('>Mermaid<')
    expect(html).toContain('Export PNG')
    expect(html).toContain('Export SVG')
    expect(html).not.toContain('Copy Mermaid')
    expect(html).toContain('aria-label="A diagram"')
  })
  it('falls back to React Flow when the model does not support the renderer', () => {
    const html = render(['react-flow', 'svg'], 'mermaid')
    expect(html).not.toContain('>Mermaid<')
    expect(html).toMatch(/role="radio" aria-checked="true"[^>]*>React Flow</)
    expect(html).not.toContain('Copy Mermaid')
  })
  it('offers the Mermaid source on the Mermaid renderer', () => {
    const html = render(['react-flow', 'svg', 'mermaid'], 'mermaid')
    expect(html).toContain('Copy Mermaid')
    expect(html).toContain('Rendering…')
  })
  it('explains line styles and extra notes in a legend', () => {
    const html = render(['svg'], 'svg')
    expect(html).toContain('aria-label="Legend"')
    for (const text of ['sync', 'async', 'data feed', 'thicker = more connections', 'a note']) {
      expect(html, text).toContain(text)
    }
  })
})
