import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { emphasise, NO_FOCUS } from '../focus'
import type { Box, DiagramModel } from '../model'
import { MIN_VIEW, SvgDiagram } from './SvgDiagram'

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
  it('frames a present-mode zoom box, widened around its centre to a readable minimum', () => {
    const view = (zoomTo?: Box) => /viewBox="([^"]+)"/.exec(renderToStaticMarkup(<SvgDiagram model={model} emphases={emphasise(model, NO_FOCUS)} zoomTo={zoomTo} />))?.[1]
    expect(view({ x: 0, y: 0, w: 1000, h: 600 })).toBe('0 0 1000 600')
    expect(view({ x: 286, y: 6, w: 238, h: 77 })).toBe(`${405 - MIN_VIEW.w / 2} ${44.5 - MIN_VIEW.h / 2} ${MIN_VIEW.w} ${MIN_VIEW.h}`)
    expect(view()).toBe('0 0 600 200')
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
  it('draws a condition as an "if" pill and dashes background jobs', () => {
    const withCondition: DiagramModel = {
      ...model,
      nodes: model.nodes.map(n => (n.id === 'calls:svc-y' ? { ...n, kind: 'job' as const } : n)),
      edges: model.edges.map(e => ({ ...e, mode: 'sync' as const, condition: 'absence shifts only' })),
    }
    const html = renderToStaticMarkup(<SvgDiagram model={withCondition} emphases={emphasise(withCondition, NO_FOCUS)} onSelect={noop} />)
    expect(html).toContain('>if absence shifts only<')
    expect(html).toContain('aria-label="svc-x → Calls · 1: SQS ×2 (if absence shifts only)"')
    expect(html).toContain('stroke-dasharray:6 4')
  })
})

describe('SvgDiagram routes', () => {
  const routed: DiagramModel = {
    ...model,
    edges: [{
      id: 'r', from: 'subject', to: 'calls:svc-y', mode: 'sync', weight: 1, label: 'GET /long/route/name', directed: true, lane: 0, lanes: 1,
      route: [{ x: 200, y: 40 }, { x: 250, y: 40 }, { x: 250, y: 44 }, { x: 310, y: 44 }],
      labelBox: { x: 210, y: 60, w: 80, h: 38 }, labelLines: ['GET /long/route', '/name'],
    }],
  }

  it('draws a routed edge along its route with its wrapped label lines', () => {
    const html = renderToStaticMarkup(<SvgDiagram model={routed} emphases={emphasise(routed, NO_FOCUS)} onSelect={noop} />)
    expect(html).toContain('points="200,40 250,40 250,44 310,44"')
    expect(html).toContain('>GET /long/route</text>')
    expect(html).toContain('>/name</text>')
  })
})
