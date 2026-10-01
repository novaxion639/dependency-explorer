import { describe, it, expect } from 'vitest'
import { ServiceFlowSchema } from '@dependency-explorer/data'
import { buildSequence } from './buildSequence'

const flow = ServiceFlowSchema.parse({
  id: 'f', name: 'F', description: 'd', steps: [{ from: 'front', to: 'skello-app', action: 'POST /x' }],
  codeUnits: [
    { id: 'c', service: 'skello-app', kind: 'controller', label: 'XController' },
    { id: 's', service: 'skello-app', kind: 'service', label: 'XService' },
  ],
  codeEdges: [
    { from: 'front', to: 'c', label: 'POST /x', mode: 'sync' },
    { from: 'c', to: 's', label: 'create', mode: 'sync' },
    { from: 's', to: 'ghost', label: 'enqueue', mode: 'async-job' },
  ],
  branches: [{ id: 'b1', at: 's', when: 'locked', outcome: '409', status: 409, evidence: { literal: ':conflict' } }],
})

describe('buildSequence', () => {
  it('numbers code edges in authored order with participants in first-appearance order', () => {
    const s = buildSequence(flow)
    expect(s.participants.map(p => p.id)).toEqual(['front', 'c', 's', 'ghost'])
    expect(s.messages.map(m => [m.n, m.from, m.to, m.async])).toEqual([[1, 'front', 'c', false], [2, 'c', 's', false], [3, 's', 'ghost', true]])
  })
  it('anchors a branch after the first message entering its unit', () => {
    expect(buildSequence(flow).branches).toEqual([{ afterMessage: 2, at: 's', text: '[locked] → 409 (409)' }])
  })
  it('falls back to services and steps without a code layer', () => {
    const plain = ServiceFlowSchema.parse({ id: 'p', name: 'P', description: 'd', steps: [{ from: 'a', to: 'b', action: 'GET /y' }] })
    const s = buildSequence(plain)
    expect(s.participants.map(p => p.id)).toEqual(['a', 'b'])
    expect(s.messages).toEqual([{ n: 1, from: 'a', to: 'b', label: 'GET /y', async: false, crud: [], badges: [] }])
  })
})

describe('buildSequence edge cases', () => {
  it('anchors branches of a flow without code edges on the step entering the unit service', () => {
    const noEdges = ServiceFlowSchema.parse({
      id: 'n', name: 'N', description: 'd',
      steps: [{ from: 'front', to: 'svc-requests', action: 'PATCH /leave-requests/:id' }],
      codeUnits: [{ id: 'm', service: 'svc-requests', kind: 'manager', label: 'LeaveRequestManager' }],
      branches: [{ id: 'b', at: 'm', when: 'not pending', outcome: '422', status: 422, evidence: { literal: 'processed' } }],
    })
    expect(buildSequence(noEdges).branches).toEqual([{ afterMessage: 1, at: 'm', text: '[not pending] → 422 (422)' }])
  })
  it('labels an edge endpoint absent from codeUnits by its id', () => {
    expect(buildSequence(flow).participants.find(p => p.id === 'ghost')).toEqual({ id: 'ghost', label: 'ghost', service: 'ghost' })
  })
})
