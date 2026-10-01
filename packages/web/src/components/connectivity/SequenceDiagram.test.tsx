import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { connectivityMap } from '@dependency-explorer/data'
import { SequenceDiagram } from './SequenceDiagram'

const flowById = (id: string) => {
  const flow = connectivityMap.flows.find(f => f.id === id)
  if (!flow) {
    throw new Error(`no flow ${id}`)
  }
  return flow
}

describe('SequenceDiagram', () => {
  it('draws numbered messages and one alt frame per branch', () => {
    const flow = flowById('leave-request-approval')
    const html = renderToStaticMarkup(<SequenceDiagram flow={flow} onSelectUnit={() => {}} />)
    expect(html.match(/>alt </g)).toHaveLength(flow.branches?.length ?? 0)
    expect(html).toContain('409 Conflict')
    expect(html).toContain('>1. </tspan>')
    expect(html).toContain(`aria-label="Sequence of ${flow.name}"`)
  })

  it('falls back to service steps for a flow without code edges', () => {
    const flow = { ...flowById('bff-dashboard-load'), codeEdges: [] }
    const html = renderToStaticMarkup(<SequenceDiagram flow={flow} onSelectUnit={() => {}} />)
    expect(html.match(/<tspan font-weight="700" fill="#818cf8">/g)).toHaveLength(flow.steps.length)
  })

  it('keeps every alt frame wide enough for its text and inside the drawing', () => {
    const html = renderToStaticMarkup(<SequenceDiagram flow={flowById('leave-request-approval')} onSelectUnit={() => {}} />)
    const svgWidth = Number(html.match(/<svg width="(\d+)"/)?.[1])
    const frames = [...html.matchAll(/<rect x="([\d.-]+)" y="[\d.-]+" width="([\d.]+)" height="[\d.]+" rx="5"[^>]*><\/rect><text[^>]*><tspan font-weight="700">alt <\/tspan>([^<]*)<\/text>/g)]
    expect(frames).toHaveLength(4)
    for (const [, x, w, text] of frames) {
      expect(Number(x)).toBeGreaterThanOrEqual(0)
      expect(Number(x) + Number(w)).toBeLessThanOrEqual(svgWidth)
      expect(Number(w)).toBeGreaterThanOrEqual((text ?? '').length * 5.5)
    }
  })
})
