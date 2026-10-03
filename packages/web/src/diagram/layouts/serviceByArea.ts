import { buildContextLanes, getServiceLane, type ConnectivityMap, type Resource, type ServiceConnection } from '@dependency-explorer/data'
import { connectionsRef, edgeLabel } from '../aggregate'
import { fitLabel, linesHeight } from '../geometry'
import { ALL_RENDERERS, edgeMode, type DiagramEdge, type DiagramModel, type DiagramNode, type EdgeMode } from '../model'
import { areaId, CLIENTS_ID, MONOLITH_ID, SUBJECT_ID } from './ids'
import { subjectCard } from './subject'

const FONT = 16
const CELL_W = 300
const GAP_X = 80
const GAP_Y = 60
const MAX_LINES = 5
const RING: Array<readonly [number, number]> = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]]
const OTHER_ID = 'area:other'

type Mark = '←' | '→' | '⇄' | '⇠'
interface AreaBox { id: string; label: string; area?: string; marks: Map<string, Mark>; conns: ServiceConnection[] }

function mark(name: string, conns: ServiceConnection[]): Mark {
  const incoming = conns.filter(c => c.to === name)
  if (incoming.length && incoming.length < conns.length) {
    return '⇄'
  }
  if (!incoming.length) {
    return '→'
  }
  return incoming.every(c => c.protocol === 'cdc') ? '⇠' : '←'
}

function capped(lines: string[]): string[] {
  return lines.length > MAX_LINES ? [...lines.slice(0, MAX_LINES - 1), `+${lines.length - MAX_LINES + 1} more`] : lines
}

function card(id: string, kind: DiagramNode['kind'], label: string, lines: string[], area?: string): DiagramNode {
  const detail = capped(lines).map(l => fitLabel(l, CELL_W, FONT))
  return {
    id, kind, label: fitLabel(label, CELL_W, FONT), detail, stores: [], fontSize: FONT,
    x: 0, y: 0, w: CELL_W, h: linesHeight(1 + detail.length, FONT), ...(area ? { ref: { type: 'area' as const, id: area } } : {}),
  }
}

function boxEdge(id: string, conns: ServiceConnection[]): DiagramEdge {
  const counts = new Map<EdgeMode, number>()
  for (const c of conns) {
    counts.set(edgeMode(c), (counts.get(edgeMode(c)) ?? 0) + 1)
  }
  const mode = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'sync'
  return { id: `${SUBJECT_ID}-${id}`, from: SUBJECT_ID, to: id, mode, weight: conns.length, label: edgeLabel(conns), directed: false, lane: 0, lanes: 1, ref: connectionsRef(conns) }
}

export function serviceByArea(map: ConnectivityMap, resources: Resource[], name: string): DiagramModel {
  const service = map.services.find(s => s.name === name)
  if (!service) {
    throw new Error(`Unknown service ${name}`)
  }
  const areas = map.areas ?? []
  const ctx = buildContextLanes(map)
  const boxOf = (s: string): { id: string; label: string; area?: string } => {
    if (ctx.clients.includes(s)) {
      return { id: CLIENTS_ID, label: 'Clients' }
    }
    if (ctx.monolith.includes(s)) {
      return { id: MONOLITH_ID, label: 'Monolith' }
    }
    const lane = getServiceLane(s, areas)
    return lane ? { id: areaId(lane.id), label: lane.name, area: lane.id } : { id: 'area:none', label: 'No area' }
  }
  const touching = map.connections.filter(c => (c.from === name) !== (c.to === name))
  const boxes = new Map<string, AreaBox>()
  for (const c of touching) {
    const meta = boxOf(c.from === name ? c.to : c.from)
    const box: AreaBox = boxes.get(meta.id) ?? { ...meta, marks: new Map(), conns: [] }
    box.conns.push(c)
    boxes.set(meta.id, box)
  }
  for (const box of boxes.values()) {
    for (const other of new Set(box.conns.map(c => (c.from === name ? c.to : c.from)))) {
      box.marks.set(other, mark(name, box.conns.filter(c => c.from === other || c.to === other)))
    }
  }
  const ranked = [...boxes.values()].sort((a, b) => b.marks.size - a.marks.size || a.label.localeCompare(b.label))
  const shown = ranked.length > RING.length ? ranked.slice(0, RING.length - 1) : ranked
  const rest = ranked.slice(shown.length)
  const markLines = (marks: Map<string, Mark>) => [...marks].sort((a, b) => a[0].localeCompare(b[0])).map(([n, m]) => `${n} ${m}`)
  const cards = shown.map(b => card(b.id, 'area', b.label, markLines(b.marks), b.area))
  if (rest.length) {
    cards.push(card(OTHER_ID, 'summary', `${rest.length} other areas`, rest.map(b => `${b.label} (${b.marks.size})`)))
  }
  const subject = subjectCard(service, resources, CELL_W, FONT)
  const rowH = [0, 1, 2].map(row => Math.max(row === 1 ? subject.h : 0, ...cards.filter((_, i) => RING[i]?.[1] === row).map(c => c.h)))
  const [h0 = 0, h1 = 0, h2 = 0] = rowH
  const rowY = [0, h0 + GAP_Y, h0 + h1 + 2 * GAP_Y]
  const centreIn = (node: DiagramNode, col: number, row: number) => {
    node.x = col * (CELL_W + GAP_X)
    node.y = Math.round((rowY[row] ?? 0) + ((rowH[row] ?? 0) - node.h) / 2)
  }
  centreIn(subject, 1, 1)
  cards.forEach((c, i) => {
    const [col, row] = RING[i] ?? [0, 0]
    centreIn(c, col, row)
  })
  const edges = [...shown.map(b => boxEdge(b.id, b.conns)), ...(rest.length ? [boxEdge(OTHER_ID, rest.flatMap(b => b.conns))] : [])]
  return {
    id: `service-areas:${name}`, title: `${name} — neighbours by product area`, width: 3 * CELL_W + 2 * GAP_X, height: h0 + h1 + h2 + 2 * GAP_Y,
    nodes: [subject, ...cards], groups: [], edges, renderers: ALL_RENDERERS,
  }
}
