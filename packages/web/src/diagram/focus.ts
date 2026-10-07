import type { Effect } from '../utils/impact'
import type { Box, DiagramModel } from './model'

export type Emphasis = 'normal' | 'dim' | 'on' | 'origin' | Effect
export type ImpactMarks = ReadonlyMap<string, Effect | 'origin'>
export interface FocusState { spotlight: string | null; impact: ImpactMarks | null; chapter?: ReadonlySet<string> | null }
export interface Emphases { nodes: Map<string, Emphasis>; groups: Map<string, Emphasis>; edges: Map<string, Emphasis> }

export const NO_FOCUS: FocusState = { spotlight: null, impact: null }
export const FOCUS_MARGIN = 24

export function focusBounds(model: DiagramModel, chapter: ReadonlySet<string> | null | undefined): Box | null {
  if (!chapter) {
    return null
  }
  const nodes = model.nodes.filter(n => chapter.has(n.id))
  const boxes: Box[] = nodes.length > 0 ? [...nodes] : model.groups.filter(g => chapter.has(g.id))
  for (const e of model.edges.filter(x => chapter.has(x.from) && chapter.has(x.to))) {
    boxes.push(...(e.route ?? []).map(p => ({ ...p, w: 0, h: 0 })), ...(e.labelBox ? [e.labelBox] : []))
  }
  if (boxes.length === 0) {
    return null
  }
  const x = Math.min(...boxes.map(b => b.x)) - FOCUS_MARGIN
  const y = Math.min(...boxes.map(b => b.y)) - FOCUS_MARGIN
  return {
    x,
    y,
    w: Math.max(...boxes.map(b => b.x + b.w)) + FOCUS_MARGIN - x,
    h: Math.max(...boxes.map(b => b.y + b.h)) + FOCUS_MARGIN - y,
  }
}

export function emphasise(model: DiagramModel, focus: FocusState): Emphases {
  const known = new Set([...model.nodes.map(n => n.id), ...model.groups.map(g => g.id)])
  const spot = focus.spotlight && known.has(focus.spotlight) ? focus.spotlight : null
  const base: Emphasis = spot || focus.impact ? 'dim' : 'normal'
  const nodes = new Map<string, Emphasis>(model.nodes.map(n => [n.id, base]))
  const groups = new Map<string, Emphasis>(model.groups.map(g => [g.id, focus.impact ? 'normal' : base]))
  const edges = new Map<string, Emphasis>(model.edges.map(e => [e.id, base]))
  if (focus.impact) {
    for (const [id, effect] of focus.impact) {
      if (nodes.has(id)) {
        nodes.set(id, effect)
      }
    }
    for (const e of model.edges) {
      if (focus.impact.has(e.from) && focus.impact.has(e.to)) {
        edges.set(e.id, 'normal')
      }
    }
    return { nodes, groups, edges }
  }
  if (focus.chapter) {
    const chapter = focus.chapter
    for (const id of nodes.keys()) {
      nodes.set(id, chapter.has(id) ? 'normal' : 'dim')
    }
    for (const id of groups.keys()) {
      groups.set(id, 'normal')
    }
    for (const e of model.edges) {
      edges.set(e.id, chapter.has(e.from) && chapter.has(e.to) ? 'normal' : 'dim')
    }
    return { nodes, groups, edges }
  }
  if (!spot) {
    return { nodes, groups, edges }
  }
  const membersOf = new Map(model.groups.map(g => [g.id, g.members]))
  const reveal = (id: string, value: Emphasis) => {
    if (nodes.has(id)) {
      nodes.set(id, value)
    }
    if (groups.has(id)) {
      groups.set(id, value)
      for (const m of membersOf.get(id) ?? []) {
        reveal(m, 'normal')
      }
    }
  }
  for (const e of model.edges) {
    if (e.from === spot || e.to === spot) {
      edges.set(e.id, 'on')
      reveal(e.from === spot ? e.to : e.from, 'normal')
    }
  }
  reveal(spot, 'on')
  return { nodes, groups, edges }
}
