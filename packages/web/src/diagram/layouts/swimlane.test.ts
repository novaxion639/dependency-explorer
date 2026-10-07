import { describe, it, expect } from 'vitest'
import { connectivityMap as map, ServiceFlowSchema } from '@dependency-explorer/data'
import { layoutProblems } from '../layoutProblems'
import { overlaps, textWidth } from '../geometry'
import type { Box, DiagramModel } from '../model'
import { chapterFocus, infraNodeId, LANE_GAP, serviceNodeId, swimlanes, unitNodeId } from './swimlane'

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
  it('focuses a drawn node for every ref of every authored chapter', () => {
    const blind = map.flows.flatMap(f => {
      const model = swimlanes(f)
      return (f.chapters ?? []).flatMap(c => c.refs.filter(ref => chapterFocus(model, f, [ref]).size === 0).map(ref => `${f.id} "${c.title}": ${ref}`))
    })
    expect(blind).toEqual([])
  })
  it('opens a store without resources in the panel', () => {
    const odd = ServiceFlowSchema.parse({
      id: 'odd', name: 'Odd', description: 'd', steps: [],
      codeUnits: [{ id: 'a', service: 'x', kind: 'service', label: 'A' }],
      infraNodes: [{ id: 'db', type: 'redis', label: 'cache' }],
      codeEdges: [{ from: 'a', to: 'db' }],
    })
    expect(swimlanes(odd).nodes.find(n => n.id === infraNodeId('db'))?.ref).toEqual({ type: 'unit', id: 'db' })
  })
  it('focuses only the lanes of a role-suffixed service ref, never its units', () => {
    const focus = chapterFocus(m, shift, ['skello-app (data)'])
    expect(focus.has('lane:skello-app')).toBe(true)
    expect(focus.has(unitNodeId('cu-create-service'))).toBe(false)
  })
  it('focuses a chapter, expanding a service that owns units to its lanes', () => {
    expect([...chapterFocus(m, shift, ['skello-app-front', 'cu-create-service', 'pg-skello-shifts'])].sort())
      .toEqual([infraNodeId('pg-skello-shifts'), serviceNodeId('skello-app-front'), unitNodeId('cu-create-service')].sort())
    const lanes = chapterFocus(m, shift, ['skello-app'])
    expect(lanes.has('lane:skello-app')).toBe(true)
    expect(lanes.has(unitNodeId('cu-activity-job'))).toBe(true)
  })
})

const ARROW = 14

function arrowBox(route: Array<{ x: number; y: number }>): Box | null {
  const q = route[route.length - 1]
  const p = route[route.length - 2]
  if (!p || !q) {
    return null
  }
  const dx = Math.sign(q.x - p.x)
  const dy = Math.sign(q.y - p.y)
  const tail = { x: q.x - dx * ARROW, y: q.y - dy * ARROW }
  return { x: Math.min(q.x, tail.x) - 5, y: Math.min(q.y, tail.y) - 5, w: Math.abs(q.x - tail.x) + 10, h: Math.abs(q.y - tail.y) + 10 }
}

function crosses(a: { x: number; y: number }, b: { x: number; y: number }, box: Box): boolean {
  return Math.min(a.x, b.x) < box.x + box.w && Math.max(a.x, b.x) > box.x && Math.min(a.y, b.y) < box.y + box.h && Math.max(a.y, b.y) > box.y
}

function nodeEdges(model: DiagramModel) {
  return model.edges
}

type Pt = { x: number; y: number }

function segmentsOf(route: Pt[]): Array<[Pt, Pt]> {
  return route.slice(1).map((q, i): [Pt, Pt] => [route[i] ?? q, q])
}

function collinearOverlap([a, b]: [Pt, Pt], [c, d]: [Pt, Pt]): number {
  if (a.y === b.y && c.y === d.y && a.y === c.y) {
    return Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x))
  }
  if (a.x === b.x && c.x === d.x && a.x === c.x) {
    return Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y))
  }
  return 0
}

describe('swimlane routes', () => {
  it('routes every edge orthogonally, never through another node', () => {
    for (const f of map.flows) {
      const model = swimlanes(f)
      for (const e of nodeEdges(model)) {
        const route = e.route ?? []
        expect(route.length, `${f.id} ${e.id}`).toBeGreaterThanOrEqual(2)
        route.slice(1).forEach((q, i) => {
          const p = route[i] ?? q
          expect(p.x === q.x || p.y === q.y, `${f.id} ${e.id} diagonal`).toBe(true)
          for (const n of model.nodes.filter(n => n.id !== e.from && n.id !== e.to)) {
            expect(crosses(p, q, n), `${f.id} ${e.id} crosses ${n.id}`).toBe(false)
          }
        })
      }
    }
  })
  it('keeps every edge label clear of nodes, other labels and arrowheads', () => {
    for (const f of map.flows) {
      const model = swimlanes(f)
      const labelled = nodeEdges(model).filter(e => e.label || e.condition)
      const arrows = nodeEdges(model).flatMap(e => {
        const box = arrowBox(e.route ?? [])
        return box ? [{ id: e.id, box }] : []
      })
      labelled.forEach((e, i) => {
        const box = e.labelBox
        expect(box, `${f.id} ${e.id} has a label box`).toBeDefined()
        if (!box) {
          return
        }
        for (const n of model.nodes) {
          expect(overlaps(box, n), `${f.id} ${e.id} label over ${n.id}`).toBe(false)
        }
        for (const other of labelled.slice(i + 1)) {
          expect(other.labelBox && overlaps(box, other.labelBox), `${f.id} ${e.id} label over ${other.id} label`).toBeFalsy()
        }
        for (const a of arrows) {
          expect(overlaps(box, a.box), `${f.id} ${e.id} label over ${a.id} arrow`).toBe(false)
        }
      })
    }
  })
  it('carries every edge label and condition in full, wrapped to fit between lanes', () => {
    const squash = (t: string) => t.replace(/\s/g, '')
    for (const f of map.flows) {
      for (const e of nodeEdges(swimlanes(f))) {
        expect(squash((e.labelLines ?? []).join('')), `${f.id} ${e.id}`).toBe(squash(e.label))
        expect(squash((e.conditionLines ?? []).join('')), `${f.id} ${e.id}`).toBe(e.condition ? squash(`if ${e.condition}`) : '')
        for (const line of [...(e.labelLines ?? []), ...(e.conditionLines ?? [])]) {
          expect(textWidth(line, 11), `${f.id} ${e.id} ${line}`).toBeLessThanOrEqual(284)
        }
      }
    }
    const replacement = swimlanes(flow('shift-replacement-search'))
    expect(replacement.edges.map(e => e.label)).toContain('GET /shifts/{shiftId}/employee_replacements')
  })
  it('never runs two edges along one line unless they leave or enter the same unit', () => {
    for (const f of map.flows) {
      const edges = swimlanes(f).edges
      edges.forEach((e, i) => {
        for (const o of edges.slice(i + 1).filter(o => o.from !== e.from && o.to !== e.to)) {
          for (const s1 of segmentsOf(e.route ?? [])) {
            for (const s2 of segmentsOf(o.route ?? [])) {
              expect(collinearOverlap(s1, s2), `${f.id} ${e.id} runs along ${o.id}`).toBeLessThanOrEqual(1)
            }
          }
        }
      })
    }
  })
  it('ends the drawing at the last lane, or at its gutter when a route uses it', () => {
    for (const f of map.flows) {
      const model = swimlanes(f)
      const last = model.groups[model.groups.length - 1]
      const lastRight = last ? last.x + last.w : 0
      const reach = Math.max(lastRight, ...model.edges.flatMap(e => [...(e.route ?? []).map(p => p.x), ...(e.labelBox ? [e.labelBox.x + e.labelBox.w] : [])]))
      expect(model.width, f.id).toBeLessThanOrEqual(reach > lastRight ? lastRight + LANE_GAP : lastRight)
    }
  })
  it('widens a gutter past its track capacity instead of sharing tracks', () => {
    const n = 40
    const wide = ServiceFlowSchema.parse({
      id: 'wide', name: 'Wide', description: 'd', steps: [],
      codeUnits: [...Array.from({ length: n }, (_, i) => ({ id: `a${i}`, service: 'x', kind: 'service', label: `A${i}` })), ...Array.from({ length: n }, (_, i) => ({ id: `b${i}`, service: 'y', kind: 'service', label: `B${i}` }))],
      codeEdges: Array.from({ length: n }, (_, i) => ({ from: `a${i}`, to: `b${i}` })),
    })
    const model = swimlanes(wide)
    expect(new Set(model.edges.map(e => e.route?.[1]?.x)).size).toBe(n)
    expect(layoutProblems(model)).toEqual([])
  })
  it('opens the gap above a row past its channel capacity instead of crossing the row above', () => {
    const n = 8
    const deep = ServiceFlowSchema.parse({
      id: 'deep', name: 'Deep', description: 'd', steps: [],
      codeUnits: [...Array.from({ length: n }, (_, i) => ({ id: `a${i}`, service: 'x', kind: 'service', label: `A${i}` })), { id: 'mid', service: 'y', kind: 'service', label: 'Mid' }, { id: 'b', service: 'z', kind: 'service', label: 'B' }],
      codeEdges: [{ from: 'a0', to: 'mid' }, ...Array.from({ length: n }, (_, i) => ({ from: `a${i}`, to: 'b' }))],
    })
    const model = swimlanes(deep)
    const target = model.nodes.find(x => x.id === unitNodeId('b'))
    const above = Math.max(...model.nodes.filter(x => target && x.y < target.y).map(x => x.y + x.h))
    expect(model.groups.map(g => g.id)).toEqual(['lane:x', 'lane:y', 'lane:z'])
    expect(model.edges.filter(e => e.to === unitNodeId('b')).every(e => (e.route?.[2]?.y ?? Infinity) > above)).toBe(true)
    expect(layoutProblems(model)).toEqual([])
  })
  it('stacks the labels of two straight-down edges between the same pair', () => {
    const twice = ServiceFlowSchema.parse({
      id: 'twice', name: 'Twice', description: 'd', steps: [],
      codeUnits: [{ id: 'a', service: 'x', kind: 'service', label: 'A' }, { id: 'b', service: 'x', kind: 'service', label: 'B' }],
      codeEdges: [{ from: 'a', to: 'b', label: 'creates' }, { from: 'a', to: 'b', label: 'updates', condition: 'when dirty' }],
    })
    const model = swimlanes(twice)
    const [first, second] = model.edges.map(e => e.labelBox)
    expect(first && second && overlaps(first, second)).toBe(false)
    for (const box of [first, second]) {
      expect(model.nodes.some(n => box && overlaps(box, n))).toBe(false)
    }
    expect(layoutProblems(model)).toEqual([])
  })
  it('sets each label against its own route, inside the drawing', () => {
    for (const f of map.flows) {
      const model = swimlanes(f)
      for (const e of model.edges.filter(e => e.labelBox)) {
        const box = e.labelBox ?? { x: 0, y: 0, w: 0, h: 0 }
        const near = { x: box.x - 2, y: box.y - 2, w: box.w + 4, h: box.h + 4 }
        expect(segmentsOf(e.route ?? []).some(([p, q]) => crosses(p, q, near) || (p.x === q.x && p.x > near.x && p.x < near.x + near.w && Math.min(p.y, q.y) <= near.y + near.h && Math.max(p.y, q.y) >= near.y) || (p.y === q.y && p.y > near.y && p.y < near.y + near.h && Math.min(p.x, q.x) <= near.x + near.w && Math.max(p.x, q.x) >= near.x)), `${f.id} ${e.id} label away from its line`).toBe(true)
        expect(box.x >= 0 && box.y >= 0 && box.x + box.w <= model.width && box.y + box.h <= model.height, `${f.id} ${e.id} label outside the drawing`).toBe(true)
      }
    }
  })
})
