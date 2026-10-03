import { describe, it, expect } from 'vitest'
import { connectivityMap as map, ServiceFlowSchema } from '@dependency-explorer/data'
import { layoutProblems } from '../layoutProblems'
import { chapterFocus, infraNodeId, serviceNodeId, swimlanes, unitNodeId } from './swimlane'

function flow(id: string) {
  const f = map.flows.find(x => x.id === id)
  if (!f) {
    throw new Error(`missing flow ${id}`)
  }
  return f
}

describe('swimlanes', () => {
  const shift = flow('shift-creation')
  const m = swimlanes(shift)
  const edgeTo = (to: string) => m.edges.find(e => e.to === to)

  it('lay out every flow soundly, drawing each unit and store once', () => {
    for (const f of map.flows) {
      const model = swimlanes(f)
      expect(layoutProblems(model), f.id).toEqual([])
      for (const u of f.codeUnits ?? []) {
        expect(model.nodes.filter(n => n.id === unitNodeId(u.id)), `${f.id} ${u.id}`).toHaveLength(1)
      }
      for (const n of f.infraNodes ?? []) {
        expect(model.nodes.filter(x => x.id === infraNodeId(n.id)), `${f.id} ${n.id}`).toHaveLength(1)
      }
    }
  })
  it('gives each service a request lane, a background lane for its jobs, one stores lane and one lane for other services', () => {
    expect(m.groups.map(g => g.label)).toEqual(['Other services', 'skello-app', 'Stores', 'skello-app · background'])
    expect(m.groups.every(g => g.kind === 'lane')).toBe(true)
  })
  it('stacks units top to bottom in call order', () => {
    const y = (id: string) => m.nodes.find(n => n.id === unitNodeId(id))?.y ?? -1
    expect(y('cu-shifts-controller')).toBeLessThan(y('cu-create-service'))
    expect(y('cu-create-service')).toBeLessThan(y('cu-tracker-service'))
  })
  it('styles edges by mode and carries conditions and flags as pills', () => {
    expect(edgeTo(unitNodeId('cu-activity-job'))).toMatchObject({ mode: 'async', condition: 'absence shifts only' })
    expect(edgeTo(unitNodeId('cu-sick-leave-service'))?.condition).toBe('FF: FEATUREDEV_CANARY_CORRECT_OVERTIME')
    expect(m.edges.find(e => e.from === infraNodeId('pg-skello-shifts'))).toMatchObject({ mode: 'data-feed', to: serviceNodeId('svc-search') })
    expect(m.edges.find(e => e.from === serviceNodeId('svc-events'))?.label).toBe('BatchWriteItem [C]')
  })
  it('marks authored branches on their unit', () => {
    expect(m.nodes.find(n => n.id === unitNodeId('cu-create-service'))?.detail.filter(l => l.startsWith('⎇'))).toHaveLength(3)
  })
  it('lays out a cycle and an isolated unit', () => {
    const odd = ServiceFlowSchema.parse({
      id: 'odd', name: 'Odd', description: 'd', steps: [],
      codeUnits: [{ id: 'a', service: 'x', kind: 'service', label: 'A' }, { id: 'b', service: 'x', kind: 'service', label: 'B' }, { id: 'c', service: 'x', kind: 'service', label: 'C' }],
      codeEdges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }],
    })
    const model = swimlanes(odd)
    expect(model.nodes).toHaveLength(3)
    expect(layoutProblems(model)).toEqual([])
  })
  it('focuses a chapter, expanding a service that owns units to its lanes', () => {
    expect([...chapterFocus(m, shift, ['skello-app-front', 'cu-create-service', 'pg-skello-shifts'])].sort())
      .toEqual([infraNodeId('pg-skello-shifts'), serviceNodeId('skello-app-front'), unitNodeId('cu-create-service')].sort())
    const lanes = chapterFocus(m, shift, ['skello-app'])
    expect(lanes.has('lane:skello-app')).toBe(true)
    expect(lanes.has(unitNodeId('cu-activity-job'))).toBe(true)
  })
})
