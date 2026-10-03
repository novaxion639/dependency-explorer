import { buildContextLanes, type ConnectivityMap, type Resource, type ServiceConnection } from '@dependency-explorer/data'
import { aggregateEdges } from '../aggregate'
import { fitLabel, linesHeight } from '../geometry'
import { ALL_RENDERERS, type DiagramGroup, type DiagramModel, type DiagramNode } from '../model'
import { SUBJECT_ID } from './ids'
import { subjectCard } from './subject'

const FONT = 12
const CHIP_W = 192
const CHIP_H = linesHeight(1, FONT)
const CHIP_GAP = 6
const HEAD = 26
const PAD = 8
const MAX_ROWS = 8
const BOTTOM_COLS = 6
const GAP = 24
const REACH = 120
const SUBJECT_W = 260

type Side = 'left' | 'right' | 'bottom'
interface Slot { key: string; label: string; side: Side; incoming: boolean; match: (c: ServiceConnection, clients: Set<string>) => boolean }
interface Placed { slot: Slot; names: string[]; cols: number; w: number; h: number; conns: ServiceConnection[] }

const SLOTS: Slot[] = [
  { key: 'clients', label: 'Clients · call it', side: 'left', incoming: true, match: (c, clients) => c.protocol !== 'cdc' && clients.has(c.from) },
  { key: 'callers', label: 'Services · call it', side: 'left', incoming: true, match: (c, clients) => c.protocol !== 'cdc' && !clients.has(c.from) },
  { key: 'calls', label: 'Calls', side: 'right', incoming: false, match: c => c.protocol !== 'cdc' && c.protocol !== 'sns' },
  { key: 'notifies', label: 'Notifies (SNS)', side: 'right', incoming: false, match: c => c.protocol === 'sns' },
  { key: 'copies-from', label: 'Copies data from (CDC)', side: 'right', incoming: false, match: c => c.protocol === 'cdc' },
  { key: 'copied-by', label: 'Copies its data (CDC)', side: 'bottom', incoming: true, match: c => c.protocol === 'cdc' },
]

export function serviceByHow(map: ConnectivityMap, resources: Resource[], name: string): DiagramModel {
  const service = map.services.find(s => s.name === name)
  if (!service) {
    throw new Error(`Unknown service ${name}`)
  }
  const clients = new Set(buildContextLanes(map).clients)
  const touching = map.connections.filter(c => c.from === name || c.to === name)
  const placed: Placed[] = SLOTS.flatMap(slot => {
    const conns = touching.filter(c => (slot.incoming ? c.to === name : c.from === name) && slot.match(c, clients))
    const names = [...new Set(conns.map(c => (slot.incoming ? c.from : c.to)))].sort()
    if (!names.length) {
      return []
    }
    const cols = slot.side === 'bottom' ? Math.min(names.length, BOTTOM_COLS) : Math.ceil(names.length / MAX_ROWS)
    const rows = Math.ceil(names.length / cols)
    return [{ slot, names, cols, conns, w: cols * CHIP_W + (cols - 1) * CHIP_GAP + 2 * PAD, h: HEAD + rows * (CHIP_H + CHIP_GAP) - CHIP_GAP + PAD }]
  })
  const stack = (side: Side) => placed.filter(p => p.slot.side === side)
  const columnWidth = (side: Side) => Math.max(0, ...stack(side).map(p => p.w))
  const columnHeight = (side: Side) => stack(side).reduce((h, p, i) => h + p.h + (i ? GAP : 0), 0)

  const subject = subjectCard(service, resources, SUBJECT_W, 13)
  const leftW = columnWidth('left')
  const subjectX = leftW ? leftW + REACH : 0
  const rightX = subjectX + SUBJECT_W + REACH
  const middleH = Math.max(columnHeight('left'), columnHeight('right'), subject.h)
  subject.x = subjectX
  subject.y = Math.round((middleH - subject.h) / 2)

  const nodes: DiagramNode[] = [subject]
  const groups: DiagramGroup[] = []
  const place = (p: Placed, x: number, y: number) => {
    const members = p.names.map((n, i) => {
      const node: DiagramNode = {
        id: `${p.slot.key}:${n}`, kind: clients.has(n) ? 'client' : 'service', label: fitLabel(n, CHIP_W, FONT), detail: [], stores: [], fontSize: FONT,
        x: x + PAD + (i % p.cols) * (CHIP_W + CHIP_GAP), y: y + HEAD + Math.floor(i / p.cols) * (CHIP_H + CHIP_GAP), w: CHIP_W, h: CHIP_H,
        ref: { type: 'service', name: n },
      }
      nodes.push(node)
      return node.id
    })
    groups.push({ id: `group:${p.slot.key}`, kind: 'group', label: `${p.slot.label} · ${p.names.length}`, members, fontSize: FONT, x, y, w: p.w, h: p.h })
  }
  for (const side of ['left', 'right'] as const) {
    let y = 0
    for (const p of stack(side)) {
      place(p, side === 'left' ? 0 : rightX, y)
      y += p.h + GAP
    }
  }
  let height = middleH
  const bottom = stack('bottom')[0]
  if (bottom) {
    const y = middleH + GAP * 2
    place(bottom, Math.max(0, Math.round(subjectX + SUBJECT_W / 2 - bottom.w / 2)), y)
    height = y + bottom.h
  }
  const slotOf = new Map(placed.flatMap(p => p.conns.map(c => [c, `group:${p.slot.key}`] as const)))
  const edges = aggregateEdges(touching, c => {
    const group = slotOf.get(c)
    if (!group) {
      return null
    }
    return c.to === name ? [group, SUBJECT_ID] : [SUBJECT_ID, group]
  })
  const width = Math.max(...[...nodes, ...groups].map(b => b.x + b.w))
  return { id: `service:${name}`, title: `${name} — grouped by how they talk`, width, height, nodes, groups, edges, renderers: ALL_RENDERERS }
}
