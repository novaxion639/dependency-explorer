// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import mermaid from 'mermaid'
import { emphasise, NO_FOCUS } from '../focus'
import type { DiagramModel, DiagramNode } from '../model'
import { toMermaid } from './toMermaid'
import { autoFlow } from '../layouts/fixtures'
import { swimlanes } from '../layouts/swimlane'

function node(id: string, label: string): DiagramNode {
  return { id, kind: 'service', label, detail: [], stores: [], fontSize: 12, x: 0, y: 0, w: 10, h: 10 }
}

const model: DiagramModel = {
  id: 'm', title: 'm', width: 10, height: 10, renderers: ['mermaid'],
  groups: [
    { id: 'band', kind: 'band', label: 'Platform', members: ['area'], fontSize: 12, x: 0, y: 0, w: 10, h: 10 },
    { id: 'area', kind: 'group', label: 'Documents & e-signature', members: ['a'], fontSize: 12, x: 0, y: 0, w: 10, h: 10 },
  ],
  nodes: [node('a', 'svc-a'), { ...node('b', 'He said "hi"'), detail: ['line two'], stores: [{ label: '▤ shifts', resource: 'pg:x' }] }],
  edges: [
    { id: 'e1', from: 'area', to: 'b', mode: 'async', weight: 4, label: 'SQS ×4', directed: true, lane: 0, lanes: 1 },
    { id: 'e2', from: 'b', to: 'a', mode: 'data-feed', weight: 1, label: 'CDC', directed: true, lane: 0, lanes: 1 },
    { id: 'e3', from: 'a', to: 'b', mode: 'sync', weight: 1, label: 'REST', directed: false, lane: 0, lanes: 1 },
  ],
}
const read = (token: string) => (token === '--highlight' ? 'gold' : 'black')

describe('toMermaid', () => {
  const source = toMermaid(model, emphasise(model, { spotlight: 'area', impact: null }), read)

  it('nests groups as subgraphs', () => {
    expect(source).toContain('subgraph g0["Platform"]')
    expect(source).toMatch(/subgraph g1\["Documents & e-signature"\]\n\s+direction LR\n\s+n0\["svc-a"\]\n\s+end\n\s+end/)
  })
  it('styles edges by mode and weight', () => {
    expect(source).toContain('g1 -.->|"SQS ×4"| n1')
    expect(source).toContain('n0 ---|"REST"| n1')
    expect(source).toMatch(/linkStyle 1 stroke-width:1.5px,stroke-dasharray:2 4/)
    expect(source).toContain('linkStyle 0 stroke-width:4.5px')
  })
  it('marks emphasis with classes', () => {
    expect(source).toContain('classDef on fill:gold,stroke:black')
    expect(source).toMatch(/class [gn0-9,]*g1[gn0-9,]* on/)
  })
  it('escapes quotes and keeps the source parseable', async () => {
    expect(source).toContain('n1["He said #quot;hi#quot;<br/>line two<br/>▤ shifts"]')
    await expect(mermaid.parse(source)).resolves.toMatchObject({ diagramType: 'flowchart-v2' })
    await expect(mermaid.parse(toMermaid(model, emphasise(model, NO_FOCUS), read))).resolves.toBeTruthy()
  })
  it('appends conditions to the edge label', () => {
    const withCondition = { ...model, edges: model.edges.map(e => (e.id === 'e1' ? { ...e, condition: 'absence shifts only' } : e)) }
    const text = toMermaid(withCondition, emphasise(withCondition, NO_FOCUS), read)
    expect(text).toContain('g1 -.->|"SQS ×4 · if absence shifts only"| n1')
  })
  it('dims edges outside the focus', () => {
    const dimmed = { nodes: new Map(), groups: new Map(), edges: new Map(model.edges.map(e => [e.id, 'dim' as const])) }
    expect(toMermaid(model, dimmed, read)).toMatch(/linkStyle 0 [^\n]*opacity:0\.45/)
    expect(toMermaid(model, emphasise(model, NO_FOCUS), read)).not.toMatch(/linkStyle[^\n]*opacity/)
  })
})

describe('toMermaid with a state machine', () => {
  it('nests a frame inside its machine subgraph, draws choices as diamonds and emits each node once', () => {
    const machineModel = swimlanes(autoFlow)
    const source = toMermaid(machineModel, emphasise(machineModel, NO_FOCUS), () => '')
    const machine = source.split('\n').findIndex(l => l.includes('subgraph') && l.includes('AutoAssign state machine'))
    const frame = source.split('\n').findIndex(l => l.includes('subgraph') && l.includes('map ×10'))
    expect(machine).toBeGreaterThan(-1)
    expect(frame).toBeGreaterThan(machine)
    expect(source).toMatch(/\{"◇ empty\?"\}/)
    expect(source.split('\n').filter(l => l.includes('eligibility per batch') && /\["|\{"/.test(l))).toHaveLength(1)
  })
})

describe('toMermaid with nested groups of equal members', () => {
  it('keeps a lane and a frame that hold the same nodes, the frame inside the lane', () => {
    const node = (id: string, x: number): DiagramNode => ({ id, kind: 'unit', label: id, detail: [], stores: [], fontSize: 12, x, y: 40, w: 80, h: 30 })
    const model: DiagramModel = {
      id: 'eq', title: 'eq', width: 400, height: 200, renderers: ['mermaid'],
      groups: [
        { id: 'lane', kind: 'machine', label: 'Machine', members: ['a'], fontSize: 12, x: 0, y: 0, w: 200, h: 200 },
        { id: 'frame', kind: 'frame', label: 'map ×2', members: ['a'], fontSize: 12, x: 5, y: 20, w: 190, h: 60 },
      ],
      nodes: [node('a', 10)],
      edges: [],
    }
    const lines = toMermaid(model, emphasise(model, NO_FOCUS), () => '').split('\n')
    const lane = lines.findIndex(l => l.includes('subgraph') && l.includes('Machine'))
    const frame = lines.findIndex(l => l.includes('subgraph') && l.includes('map ×2'))
    expect(lane).toBeGreaterThan(-1)
    expect(frame).toBeGreaterThan(lane)
    expect(lines.filter(l => l.includes('["a"]'))).toHaveLength(1)
  })
})
