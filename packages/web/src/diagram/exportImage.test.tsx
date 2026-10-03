import { describe, it, expect } from 'vitest'
import { emphasise, NO_FOCUS } from './focus'
import type { DiagramModel } from './model'
import { exportName, standaloneSvg, svgSize, withPositions } from './exportImage'
import { inlineTokens } from './tokens'

const model: DiagramModel = {
  id: 'm', title: 'm', width: 300, height: 120, renderers: ['svg'], groups: [], edges: [],
  nodes: [{ id: 'a', kind: 'service', label: 'svc-a', detail: [], stores: [], fontSize: 12, x: 10, y: 10, w: 120, h: 29 }],
}
const read = (token: string) => `#${token.length.toString(16).padStart(6, '0')}`

describe('export', () => {
  it('replaces theme tokens with their values', () => {
    expect(inlineTokens('fill:var(--ink);stroke:var(--rule-strong)', t => (t === '--ink' ? '#111111' : '#222222'))).toBe('fill:#111111;stroke:#222222')
  })
  it('serialises a standalone SVG with tokens resolved', () => {
    const svg = standaloneSvg(model, emphasise(model, NO_FOCUS), read)
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('width="300"')
    expect(svg).toContain('height="120"')
    expect(svg).not.toContain('var(--')
    expect(svg).toContain('svc-a')
  })
  it('reads the size from the viewBox', () => {
    expect(svgSize('<svg viewBox="-8 -8 640.5 300">')).toEqual({ width: 641, height: 300 })
  })
  it('applies dragged positions and grows the canvas to fit them', () => {
    const moved = withPositions(model, new Map([['a', { x: -20, y: 200 }]]))
    expect(moved.nodes[0]).toMatchObject({ x: 0, y: 200 })
    expect([moved.width, moved.height]).toEqual([320, 229])
  })
  it('date-stamps export file names', () => {
    expect(exportName('service_svc-punch', 'png')).toMatch(/^service_svc-punch_\d{4}-\d{2}-\d{2}\.png$/)
  })
})
