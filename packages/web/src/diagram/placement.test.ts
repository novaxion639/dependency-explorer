import { describe, it, expect } from 'vitest'
import type { DiagramModel } from './model'
import { moveNode, NO_PLACEMENT, placed, placedForExport } from './placement'

const model = (id: string, label = 'REST'): DiagramModel => ({
  id, title: id, width: 300, height: 120, renderers: ['svg'], groups: [],
  nodes: [{ id: 'a', kind: 'service', label: 'svc-a', detail: [], stores: [], fontSize: 12, x: 10, y: 10, w: 120, h: 29 }],
  edges: [{ id: 'e', from: 'a', to: 'a', mode: 'sync', weight: 1, label, directed: true, lane: 0, lanes: 1 }],
})

describe('placement', () => {
  it('keeps a dragged node where it was dropped when the same view re-renders with new edges or emphasis', () => {
    const moved = moveNode(NO_PLACEMENT, 'm', 'a', { x: 200, y: 80 })
    expect(placed(model('m', 'SQS'), moved).nodes[0]).toMatchObject({ x: 200, y: 80 })
    expect(placed(model('m'), moveNode(NO_PLACEMENT, 'm', 'a', { x: 250, y: 200 }))).toMatchObject({ width: 370, height: 229 })
  })
  it('forgets drags when the view changes', () => {
    const moved = moveNode(NO_PLACEMENT, 'm', 'a', { x: 200, y: 80 })
    expect(placed(model('other'), moved).nodes[0]).toMatchObject({ x: 10, y: 10 })
    expect(moveNode(moved, 'other', 'a', { x: 1, y: 2 }).positions.size).toBe(1)
  })
  it('exports exactly what is drawn, with the canvas grown to fit', () => {
    const moved = moveNode(NO_PLACEMENT, 'm', 'a', { x: 250, y: 200 })
    const out = placedForExport(model('m'), moved)
    expect(out.nodes[0]).toMatchObject({ x: 250, y: 200 })
    expect([out.width, out.height]).toEqual([370, 229])
    expect(placedForExport(model('other'), moved)).toEqual(model('other'))
  })
})
