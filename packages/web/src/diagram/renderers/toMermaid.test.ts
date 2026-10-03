// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import mermaid from 'mermaid'
import { emphasise, NO_FOCUS } from '../focus'
import type { DiagramModel, DiagramNode } from '../model'
import { toMermaid } from './toMermaid'

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
})
