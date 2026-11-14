// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { emphasise, NO_FOCUS, type FocusState } from '../focus'
import type { Box, DiagramModel } from '../model'
import { MIN_VIEW, SvgDiagram } from './SvgDiagram'
import { autoFlow } from '../layouts/fixtures'
import { swimlanes } from '../layouts/swimlane'

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

const draw = (m: DiagramModel, options: { select?: boolean; zoomTo?: Box; focus?: FocusState } = {}) =>
  render(<SvgDiagram model={m} emphases={emphasise(m, options.focus ?? NO_FOCUS)} zoomTo={options.zoomTo} onSelect={options.select === false ? undefined : noop} />)

const image = () => screen.getByRole('img')
const dashes = () => [...image().querySelectorAll<SVGElement>('path, line, polyline, rect')].map(el => el.style.strokeDasharray)

describe('SvgDiagram', () => {
  it('draws the diagram as one titled image', () => {
    draw(model)

    expect(screen.getByRole('img', { name: 'svc-x — grouped by how they talk' })).toBeTruthy()
  })

  it.each(['svc-x', 'TypeScript service', '▤ table', 'Calls · 1', 'svc-y', 'SQS ×2'])('draws the text %s', text => {
    draw(model)

    expect(within(image()).getAllByText(text, { exact: false }).length).toBeGreaterThan(0)
  })

  it.each(['svc-y', 'Calls · 1', 'Open ▤ table', 'svc-x → Calls · 1: SQS ×2'])('makes %s a keyboard-reachable button', name => {
    draw(model)

    expect(screen.getByRole('button', { name }).getAttribute('tabindex')).toBe('0')
  })

  it('makes every node, group, store and edge a button', () => {
    draw(model)

    expect(screen.getAllByRole('button')).toHaveLength(5)
  })

  it.each([
    ['a large zoom box as is', { x: 0, y: 0, w: 1000, h: 600 }, '0 0 1000 600'],
    ['a small zoom box widened around its centre', { x: 286, y: 6, w: 238, h: 77 }, `${405 - MIN_VIEW.w / 2} ${44.5 - MIN_VIEW.h / 2} ${MIN_VIEW.w} ${MIN_VIEW.h}`],
  ])('frames %s in present mode', (_name, zoomTo, viewBox) => {
    draw(model, { zoomTo, select: false })

    expect(image().getAttribute('viewBox')).toBe(viewBox)
  })

  it('frames the whole model without a zoom box', () => {
    draw(model, { select: false })

    expect(image().getAttribute('viewBox')).toBe('0 0 600 200')
  })

  it('dashes async edges', () => {
    draw(model, { select: false })

    expect(dashes()).toContain('6 4')
  })

  it('draws an arrow on directed edges, sized in user space', () => {
    draw(model, { select: false })

    expect(image().querySelector('[marker-end="url(#svc-arrow)"]')).not.toBeNull()
    expect(image().querySelector('marker')?.getAttribute('markerUnits')).toBe('userSpaceOnUse')
  })

  it('names the impact effect of a node', () => {
    draw(model, { focus: { spotlight: null, impact: new Map([['calls:svc-y', 'fails']]) } })

    expect(screen.getByRole('button', { name: 'svc-y — fails' })).toBeTruthy()
  })

  it('renders no buttons without a select handler', () => {
    draw(model, { select: false })

    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  describe('with a condition and a background job', () => {
    const withCondition: DiagramModel = {
      ...model,
      nodes: model.nodes.map(n => (n.id === 'calls:svc-y' ? { ...n, kind: 'job' as const } : n)),
      edges: model.edges.map(e => ({ ...e, mode: 'sync' as const, condition: 'absence shifts only' })),
    }

    it('draws the condition as an "if" pill', () => {
      draw(withCondition)

      expect(within(image()).getByText('if absence shifts only')).toBeTruthy()
    })

    it('names the condition on the edge button', () => {
      draw(withCondition)

      expect(screen.getByRole('button', { name: 'svc-x → Calls · 1: SQS ×2 (if absence shifts only)' })).toBeTruthy()
    })

    it('dashes the background job', () => {
      draw(withCondition)

      expect(dashes()).toContain('6 4')
    })
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

  it('draws a routed edge along its route', () => {
    draw(routed)

    expect([...image().querySelectorAll('polyline')].map(p => p.getAttribute('points'))).toContain('200,40 250,40 250,44 310,44')
  })

  it.each(['GET /long/route', '/name'])('wraps the route label onto the line %s', line => {
    draw(routed)

    expect(within(image()).getByText(line)).toBeTruthy()
  })
})

describe('SvgDiagram with a state machine', () => {
  const machineModel = swimlanes(autoFlow)

  it('draws the frame with a short dash', () => {
    draw(machineModel, { select: false })

    expect(dashes()).toContain('3 3')
  })

  it('names the machine lane', () => {
    draw(machineModel, { select: false })

    expect(within(image()).getByText('AutoAssign state machine', { exact: false })).toBeTruthy()
  })
})
