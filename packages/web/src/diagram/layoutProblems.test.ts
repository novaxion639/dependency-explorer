import { describe, it, expect } from 'vitest'
import { layoutProblems } from './layoutProblems'
import type { DiagramModel, DiagramNode } from './model'

function node(id: string, x: number, y: number, label = id): DiagramNode {
  return { id, kind: 'service', label, detail: [], stores: [], fontSize: 12, x, y, w: 100, h: 29 }
}

const sound: DiagramModel = {
  id: 'm', title: 'm', width: 400, height: 200, renderers: ['svg'],
  groups: [{ id: 'G', kind: 'group', label: 'Group', members: ['a'], fontSize: 12, x: 0, y: 0, w: 140, h: 80 }],
  nodes: [node('a', 10, 30), node('b', 200, 30)],
  edges: [{ id: 'e', from: 'G', to: 'b', mode: 'sync', weight: 1, label: 'REST', directed: true, lane: 0, lanes: 1 }],
}

describe('layoutProblems', () => {
  it('accepts a sound layout', () => {
    expect(layoutProblems(sound)).toEqual([])
  })
  it('reports overlaps, strays, dangling edges, overflow and boxes off the canvas', () => {
    const broken: DiagramModel = {
      ...sound,
      nodes: [node('a', 10, 30), node('b', 60, 30), node('c', 350, 190, 'a label far too long for its box')],
      edges: [...sound.edges, { ...sound.edges[0], id: 'x', to: 'ghost' }],
    }
    const text = layoutProblems(broken).join('\n')
    expect(text).toContain('nodes overlap: a / b')
    expect(text).toContain('node b straddles G')
    expect(text).toContain('edge joins a missing box: x')
    expect(text).toContain('text overflows: c')
    expect(text).toContain('box leaves the canvas')
  })
})
