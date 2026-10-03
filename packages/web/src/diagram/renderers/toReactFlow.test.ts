import { describe, it, expect } from 'vitest'
import { emphasise } from '../focus'
import type { DiagramModel } from '../model'
import { toReactFlow } from './toReactFlow'

const model: DiagramModel = {
  id: 'm', title: 'm', width: 600, height: 200, renderers: ['react-flow'],
  groups: [{ id: 'G', kind: 'group', label: 'G', members: ['a'], fontSize: 12, x: 0, y: 0, w: 220, h: 80 }],
  nodes: [
    { id: 'a', kind: 'service', label: 'a', detail: [], stores: [], fontSize: 12, x: 10, y: 30, w: 190, h: 29 },
    { id: 'b', kind: 'service', label: 'b', detail: [], stores: [], fontSize: 12, x: 400, y: 30, w: 190, h: 29 },
  ],
  edges: [
    { id: 'G>b:sync', from: 'G', to: 'b', mode: 'sync', weight: 3, label: 'REST ×3', directed: true, lane: 0, lanes: 1 },
    { id: 's-b', from: 'a', to: 'b', mode: 'sync', weight: 1, label: 'REST', directed: false, lane: 0, lanes: 1 },
  ],
}

describe('toReactFlow', () => {
  const flow = toReactFlow(model, emphasise(model, { spotlight: 'G', impact: null }))

  it('places groups first, behind nodes and fixed in place', () => {
    expect(flow.nodes.map(n => n.id)).toEqual(['G', 'a', 'b'])
    expect(flow.nodes[0]).toMatchObject({ type: 'diagramGroup', position: { x: 0, y: 0 }, width: 220, height: 80, zIndex: -1, draggable: false })
  })
  it('keeps model positions and sizes on nodes', () => {
    expect(flow.nodes[2]).toMatchObject({ type: 'diagramNode', position: { x: 400, y: 30 }, width: 190, height: 29 })
  })
  it('carries emphasis to nodes and edges', () => {
    expect(flow.nodes[0]?.data).toMatchObject({ emphasis: 'on' })
    expect(flow.edges.map(e => e.data?.emphasis)).toEqual(['on', 'dim'])
  })
  it('puts an arrow on directed edges only', () => {
    expect(flow.edges[0]?.markerEnd).toBeDefined()
    expect(flow.edges[1]?.markerEnd).toBeUndefined()
    expect(flow.edges[0]).toMatchObject({ source: 'G', target: 'b', type: 'diagramEdge' })
  })
})
