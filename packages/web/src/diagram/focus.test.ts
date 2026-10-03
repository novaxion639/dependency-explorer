import { describe, it, expect } from 'vitest'
import { emphasise, NO_FOCUS } from './focus'
import type { DiagramModel, DiagramNode } from './model'

function node(id: string, x: number): DiagramNode {
  return { id, kind: 'service', label: id, detail: [], stores: [], fontSize: 12, x, y: 40, w: 80, h: 30 }
}

const model: DiagramModel = {
  id: 'm', title: 'm', width: 600, height: 200, renderers: ['svg'],
  groups: [{ id: 'G', kind: 'group', label: 'G', members: ['n1', 'n2'], fontSize: 12, x: 0, y: 0, w: 200, h: 100 }],
  nodes: [node('n1', 10), node('n2', 100), node('n3', 300), node('n4', 450)],
  edges: [
    { id: 'e1', from: 'G', to: 'n3', mode: 'sync', weight: 1, label: 'REST', directed: true, lane: 0, lanes: 1 },
    { id: 'e2', from: 'n3', to: 'n4', mode: 'async', weight: 1, label: 'SQS', directed: true, lane: 0, lanes: 1 },
  ],
}

describe('emphasise', () => {
  it('leaves everything normal without focus', () => {
    const e = emphasise(model, NO_FOCUS)
    expect([...e.nodes.values(), ...e.groups.values(), ...e.edges.values()].every(v => v === 'normal')).toBe(true)
  })
  it('lights a spotlit group, its members, its edges and their far ends, and dims the rest', () => {
    const e = emphasise(model, { spotlight: 'G', impact: null })
    expect(e.groups.get('G')).toBe('on')
    expect([e.nodes.get('n1'), e.nodes.get('n2'), e.nodes.get('n3')]).toEqual(['normal', 'normal', 'normal'])
    expect(e.edges.get('e1')).toBe('on')
    expect(e.nodes.get('n4')).toBe('dim')
    expect(e.edges.get('e2')).toBe('dim')
  })
  it('ignores a spotlight the model does not contain', () => {
    const e = emphasise(model, { spotlight: 'area:search', impact: null })
    expect([...e.nodes.values()].every(v => v === 'normal')).toBe(true)
  })
  it('colours impacted nodes by effect, keeps groups as context and dims the rest', () => {
    const e = emphasise(model, { spotlight: null, impact: new Map([['n3', 'fails'], ['n4', 'origin']]) })
    expect([e.nodes.get('n3'), e.nodes.get('n4'), e.nodes.get('n1')]).toEqual(['fails', 'origin', 'dim'])
    expect(e.groups.get('G')).toBe('normal')
    expect([e.edges.get('e2'), e.edges.get('e1')]).toEqual(['normal', 'dim'])
  })
  it('focuses a chapter: its members stay, the rest dims, groups stay as context', () => {
    const e = emphasise(model, { spotlight: null, impact: null, chapter: new Set(['n3', 'n4']) })
    expect([e.nodes.get('n3'), e.nodes.get('n4'), e.nodes.get('n1')]).toEqual(['normal', 'normal', 'dim'])
    expect(e.groups.get('G')).toBe('normal')
    expect([e.edges.get('e2'), e.edges.get('e1')]).toEqual(['normal', 'dim'])
  })
})
