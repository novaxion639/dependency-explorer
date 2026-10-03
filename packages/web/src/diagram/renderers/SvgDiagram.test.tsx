import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { emphasise, NO_FOCUS } from '../focus'
import type { DiagramModel } from '../model'
import { SvgDiagram } from './SvgDiagram'

const model: DiagramModel = {
  id: 'svc', title: 'svc-x — grouped by how they talk', width: 600, height: 200, renderers: ['svg'],
  groups: [{ id: 'group:calls', kind: 'group', label: 'Calls · 1', members: ['calls:svc-y'], fontSize: 12, x: 300, y: 0, w: 220, h: 70, ref: { type: 'area', id: 'planning' } }],
  nodes: [
    { id: 'subject', kind: 'subject', label: 'svc-x', detail: ['TypeScript service'], stores: [{ label: '▤ table', resource: 'pg:db.table' }], fontSize: 13, x: 0, y: 0, w: 200, h: 80, ref: { type: 'service', name: 'svc-x' } },
    { id: 'calls:svc-y', kind: 'service', label: 'svc-y', detail: [], stores: [], fontSize: 12, x: 310, y: 30, w: 190, h: 29, ref: { type: 'service', name: 'svc-y' } },
  ],
  edges: [{ id: 'subject>group:calls:async', from: 'subject', to: 'group:calls', mode: 'async', weight: 2, label: 'SQS ×2', directed: true, lane: 0, lanes: 1, ref: { type: 'connections', keys: ['svc-x~svc-y~sqs'] } }],
}

const noop = () => {}

describe('SvgDiagram', () => {
  it('draws boxes, labels, stores and edge labels as one titled image', () => {
    const html = renderToStaticMarkup(<SvgDiagram model={model} emphases={emphasise(model, NO_FOCUS)} onSelect={noop} />)
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="svc-x — grouped by how they talk"')
    for (const text of ['svc-x', 'TypeScript service', '▤ table', 'Calls · 1', 'svc-y', 'SQS ×2']) {
      expect(html, text).toContain(text)
    }
  })
  it('makes nodes, groups, stores and edges keyboard-reachable buttons', () => {
    const html = renderToStaticMarkup(<SvgDiagram model={model} emphases={emphasise(model, NO_FOCUS)} onSelect={noop} />)
    expect(html).toContain('aria-label="svc-y"')
    expect(html).toContain('aria-label="Calls · 1"')
    expect(html).toContain('aria-label="Open ▤ table"')
    expect(html).toContain('aria-label="svc-x → Calls · 1: SQS ×2"')
    expect(html.match(/role="button"/g)?.length).toBe(5)
  })
  it('dashes async edges and draws an arrow on directed ones', () => {
    const html = renderToStaticMarkup(<SvgDiagram model={model} emphases={emphasise(model, NO_FOCUS)} />)
    expect(html).toContain('stroke-dasharray:6 4')
    expect(html).toContain('marker-end="url(#svc-arrow)"')
    expect(html).toContain('markerUnits="userSpaceOnUse"')
  })
  it('names the impact effect of a node', () => {
    const html = renderToStaticMarkup(<SvgDiagram model={model} emphases={emphasise(model, { spotlight: null, impact: new Map([['calls:svc-y', 'fails']]) })} onSelect={noop} />)
    expect(html).toContain('aria-label="svc-y — fails"')
  })
  it('renders no buttons without a select handler', () => {
    expect(renderToStaticMarkup(<SvgDiagram model={model} emphases={emphasise(model, NO_FOCUS)} />)).not.toContain('role="button"')
  })
})
