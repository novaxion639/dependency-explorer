import type { FlowCodeEdge, FlowCodeUnit, ServiceFlow } from '@dependency-explorer/data'
import { EDGE_LABEL_FONT, EDGE_LABEL_LINE, fitLabel, linesHeight, overlaps, textWidth, wrapText } from '../geometry'
import { ALL_RENDERERS, type Box, type DiagramEdge, type DiagramGroup, type DiagramModel, type DiagramNode, type EdgeMode, type RoutePoint } from '../model'

const FONT = 12
const LANE_W = 250
export const LANE_GAP = 280
const PAD = 12
const HEAD = 80
const ROW_GAP = 64
const NODE_W = LANE_W - 2 * PAD
const LABEL_PAD = 8
const PILL_PAD = 18
const LABEL_FRAME = 4
const LABEL_MARGIN = 4
const ARROW = 14
const ARROW_CLEARANCE = 6
export const WRAP_W = LANE_GAP + 2 * PAD - 2 * (ARROW + ARROW_CLEARANCE) - LABEL_PAD - 4
const LAYOUT_PASSES = 12
const TRACK = 8
const CHANNEL = 19
const HEADER_Y = 6
const HEADER_H = 24
const LABEL_STEP = 4
const PORT = { inLeft: 1 / 5, inRight: 2 / 5, outLeft: 3 / 5, outRight: 4 / 5 }

export const STORES_LANE = 'lane:stores'
export const OTHERS_LANE = 'lane:others'

const KIND_LABEL: Record<FlowCodeUnit['kind'], string> = {
  controller: 'controller', service: 'service', manager: 'manager', job: 'background job',
  'model-callback': 'model callbacks', component: 'UI component', client: 'HTTP client',
}
const MODE_RANK: Record<NonNullable<FlowCodeEdge['mode']>, number> = { sync: 0, 'async-job': 1, 'async-event': 2 }

export function unitNodeId(id: string): string {
  return `u:${id}`
}
export function infraNodeId(id: string): string {
  return `i:${id}`
}
export function serviceNodeId(name: string): string {
  return `s:${name}`
}
export function requestLane(service: string): string {
  return `lane:${service}`
}
export function backgroundLane(service: string): string {
  return `lane:${service}:bg`
}

function edgeText(label: string | undefined, crud: string[] | undefined): string {
  const letters = crud?.length ? ` [${crud.map(c => c.slice(0, 1).toUpperCase()).join('')}]` : ''
  return `${label ?? ''}${letters}`.trim()
}

function edgeCondition(e: FlowCodeEdge): string | undefined {
  if (e.condition) {
    return e.condition
  }
  return e.flags?.length ? `🚩 ${e.flags.map(f => f.name).join(', ')}` : undefined
}

export function swimlanes(flow: ServiceFlow): DiagramModel {
  let extra = new Map<number, number>()
  let detours = new Set<string>()
  let wider = new Map<number, number>()
  let result = laneLayout(flow, extra, detours, wider)
  for (let pass = 1; pass < LAYOUT_PASSES && (result.crowded.length > 0 || result.overflow.size > 0); pass++) {
    extra = new Map(extra)
    detours = new Set(detours)
    wider = new Map(wider)
    for (const { row, h, edge } of result.crowded) {
      extra.set(row, (extra.get(row) ?? 0) + h)
      if (edge) {
        detours.add(edge)
      }
    }
    for (const [gutter, missing] of result.overflow) {
      wider.set(gutter, (wider.get(gutter) ?? 0) + missing * TRACK)
    }
    result = laneLayout(flow, extra, detours, wider)
  }
  return result.model
}

interface Crowding { row: number; h: number; edge?: string }

function laneLayout(flow: ServiceFlow, extra: ReadonlyMap<number, number>, detours: ReadonlySet<string>, wider: ReadonlyMap<number, number>): { model: DiagramModel; crowded: Crowding[]; overflow: Map<number, number> } {
  const units = new Map((flow.codeUnits ?? []).map(u => [u.id, u]))
  const infra = new Map((flow.infraNodes ?? []).map(n => [n.id, n]))
  const codeEdges = flow.codeEdges ?? []
  const asyncTargets = new Set(codeEdges.filter(e => e.mode === 'async-job').map(e => e.to))
  const unitServices = new Set([...units.values()].map(u => u.service))

  const ids: string[] = []
  const add = (id: string) => {
    if (!ids.includes(id)) {
      ids.push(id)
    }
  }
  for (const e of codeEdges) {
    add(e.from)
    add(e.to)
  }
  for (const id of units.keys()) {
    add(id)
  }
  for (const id of infra.keys()) {
    add(id)
  }
  const infraLinks = (flow.infraEdges ?? []).filter(e => {
    const store = infra.has(e.to) ? e.to : e.from
    const owner = store === e.to ? e.from : e.to
    return !codeEdges.some(c => (c.from === store || c.to === store) && (units.get(c.from)?.service === owner || units.get(c.to)?.service === owner))
  })
  for (const e of infraLinks) {
    add(e.from)
    add(e.to)
  }

  const out = new Map<string, FlowCodeEdge[]>()
  for (const e of codeEdges) {
    out.set(e.from, [...(out.get(e.from) ?? []), e])
  }
  for (const list of out.values()) {
    list.sort((a, b) => MODE_RANK[a.mode ?? 'sync'] - MODE_RANK[b.mode ?? 'sync'])
  }
  const incoming = new Set(codeEdges.map(e => e.to))
  const depth = new Map<string, number>()
  const order: string[] = []
  const visit = (id: string, d: number) => {
    if (depth.has(id)) {
      return
    }
    depth.set(id, d)
    order.push(id)
    for (const e of out.get(id) ?? []) {
      visit(e.to, d + 1)
    }
  }
  for (const id of ids.filter(id => !incoming.has(id))) {
    visit(id, 0)
  }
  for (const id of ids) {
    visit(id, 0)
  }

  const laneOf = (id: string): string => {
    const unit = units.get(id)
    if (unit) {
      return unit.kind === 'job' || asyncTargets.has(id) ? backgroundLane(unit.service) : requestLane(unit.service)
    }
    if (infra.has(id)) {
      return STORES_LANE
    }
    return unitServices.has(id) ? requestLane(id) : OTHERS_LANE
  }
  const isLaneEndpoint = (id: string) => !units.has(id) && !infra.has(id) && unitServices.has(id)

  const nodeOf = (id: string): DiagramNode => {
    const unit = units.get(id)
    if (unit) {
      const lines = [
        KIND_LABEL[unit.kind],
        ...(unit.flags ?? []).map(f => `🚩 ${f.name}`),
        ...(flow.branches ?? []).filter(b => b.at === id).map(b => `⎇ ${b.status ? `${b.status} · ` : ''}${b.when}`),
      ].map(l => fitLabel(l, NODE_W, FONT))
      return { id: unitNodeId(id), kind: unit.kind === 'job' ? 'job' : 'unit', label: fitLabel(unit.label, NODE_W, FONT), detail: lines, stores: [], fontSize: FONT, x: 0, y: 0, w: NODE_W, h: linesHeight(1 + lines.length, FONT), ref: { type: 'unit', id } }
    }
    const store = infra.get(id)
    if (store) {
      const resource = store.resources?.[0]
      return { id: infraNodeId(id), kind: 'store', label: fitLabel(store.label, NODE_W, FONT), detail: [store.type], stores: [], fontSize: FONT, x: 0, y: 0, w: NODE_W, h: linesHeight(2, FONT), ref: resource ? { type: 'resource', id: resource } : { type: 'unit', id } }
    }
    return { id: serviceNodeId(id), kind: 'service', label: fitLabel(id, NODE_W, FONT), detail: [], stores: [], fontSize: FONT, x: 0, y: 0, w: NODE_W, h: linesHeight(1, FONT), ref: { type: 'service', name: id } }
  }

  const laneOrder: string[] = []
  const rowOf = new Map<string, number>()
  const nextRow = new Map<string, number>()
  const nodes: DiagramNode[] = []
  for (const id of order) {
    const lane = laneOf(id)
    if (!laneOrder.includes(lane)) {
      laneOrder.push(lane)
    }
    if (isLaneEndpoint(id)) {
      continue
    }
    const row = Math.max(depth.get(id) ?? 0, nextRow.get(lane) ?? 0)
    rowOf.set(id, row)
    nextRow.set(lane, row + 1)
    nodes.push(nodeOf(id))
  }
  const byId = new Map(nodes.map(n => [n.id, n]))
  const gutterW = (gutter: number) => LANE_GAP + (wider.get(gutter) ?? 0)
  const laneX = (i: number) => i * LANE_W + Array.from({ length: Math.max(0, i) }, (_, g) => gutterW(g)).reduce((sum, w) => sum + w, 0)
  const modelId = (id: string) => (units.has(id) ? unitNodeId(id) : infra.has(id) ? infraNodeId(id) : isLaneEndpoint(id) ? requestLane(id) : serviceNodeId(id))

  const wrapped = (text: string) => wrapText(text, WRAP_W, EDGE_LABEL_FONT)
  const labelHeight = (lines: number) => (lines > 0 ? lines * EDGE_LABEL_LINE + LABEL_FRAME : 0)
  const edges: DiagramEdge[] = []
  const push = (from: string, to: string, mode: EdgeMode, label: string, condition?: string): DiagramEdge | null => {
    const a = modelId(from)
    const b = modelId(to)
    if (a === b) {
      return null
    }
    const edge: DiagramEdge = {
      id: `e${edges.length}:${a}>${b}`, from: a, to: b, mode, weight: 1, label, directed: true, lane: 0, lanes: 1, labelLines: wrapped(label),
      ...(condition ? { condition, conditionLines: wrapped(`if ${condition}`) } : {}),
    }
    edges.push(edge)
    return edge
  }
  const lineCount = (e: DiagramEdge) => (e.labelLines?.length ?? 0) + (e.conditionLines?.length ?? 0)
  const directGap = new Map<number, number>()
  const directLabelH = new Map<number, number>()
  const stacked = new Map<string, number>()
  const pairs = [
    ...codeEdges.map(e => {
      const mode: EdgeMode = infra.has(e.from) ? 'data-feed' : e.mode === 'async-job' || e.mode === 'async-event' ? 'async' : 'sync'
      return { from: e.from, to: e.to, edge: push(e.from, e.to, mode, edgeText(e.label, e.crud), edgeCondition(e)) }
    }),
    ...infraLinks.map(e => ({ from: e.from, to: e.to, edge: push(e.from, e.to, 'sync', edgeText(e.label, e.crud)) })),
  ].flatMap(({ from, to, edge }) => (edge ? [{ from, to, h: labelHeight(lineCount(edge)) }] : []))
  for (const p of pairs) {
    const ra = rowOf.get(p.from)
    const rb = rowOf.get(p.to)
    if (ra === undefined || rb === undefined || rb <= ra || laneOf(p.from) !== laneOf(p.to)) {
      continue
    }
    const between = order.some(id => id !== p.from && id !== p.to && laneOf(id) === laneOf(p.from) && (rowOf.get(id) ?? -1) > ra && (rowOf.get(id) ?? -1) < rb)
    if (!between) {
      const before = stacked.get(p.from) ?? 0
      const stack = p.h > 0 ? before + (before > 0 ? LABEL_MARGIN : 0) + p.h : before
      stacked.set(p.from, stack)
      directGap.set(ra, Math.max(directGap.get(ra) ?? 0, stack + LABEL_MARGIN + ARROW + 2 * ARROW_CLEARANCE + 2))
      directLabelH.set(ra, Math.max(directLabelH.get(ra) ?? 0, stack))
    }
  }
  const gapAfter = (row: number) => Math.max(ROW_GAP, directGap.get(row) ?? 0) + (extra.get(row) ?? 0)
  const top = HEAD + (extra.get(-1) ?? 0)

  const rows = Math.max(0, ...rowOf.values()) + 1
  const rowH = Array.from({ length: rows }, (_, r) => Math.max(0, ...order.filter(id => rowOf.get(id) === r).map(id => byId.get(modelId(id))?.h ?? 0)))
  const rowY: number[] = []
  rowH.reduce((y, h, r) => {
    rowY[r] = y
    return y + h + gapAfter(r)
  }, top)
  const height = top + rowH.reduce((sum, h, r) => sum + h + gapAfter(r), 0) + PAD
  for (const id of order) {
    const node = byId.get(modelId(id))
    const row = rowOf.get(id)
    if (node && row !== undefined) {
      node.x = laneX(laneOrder.indexOf(laneOf(id))) + PAD
      node.y = rowY[row] ?? top
    }
  }
  const laneLabel = (lane: string) => {
    if (lane === STORES_LANE) {
      return 'Stores'
    }
    if (lane === OTHERS_LANE) {
      return 'Other services'
    }
    return lane.endsWith(':bg') ? `${lane.slice(5, -3)} · background` : lane.slice(5)
  }
  const laneIndex = new Map(order.filter(id => !isLaneEndpoint(id)).map(id => [modelId(id), laneOrder.indexOf(laneOf(id))]))
  const tracks = new Map<number, number>()
  const overflow = new Map<number, number>()
  const trackX = (gutter: number) => {
    const k = tracks.get(gutter) ?? 0
    tracks.set(gutter, k + 1)
    const capacity = Math.floor(gutterW(gutter) / TRACK) - 2
    if (k >= capacity) {
      overflow.set(gutter, Math.max(overflow.get(gutter) ?? 0, k - capacity + 1))
    }
    return laneX(gutter) + LANE_W + TRACK * (1 + k)
  }
  const channels = new Map<number, number>()
  const crowded: Crowding[] = []
  const channelY = (row: number) => {
    const rowTop = rowY[row] ?? top
    const k = channels.get(rowTop) ?? 0
    channels.set(rowTop, k + 1)
    const y = rowTop - CHANNEL - TRACK * k
    const floor = (row > 0 ? (rowY[row - 1] ?? top) + (rowH[row - 1] ?? 0) : HEADER_Y + HEADER_H) + TRACK
    if (y < floor) {
      crowded.push({ row: row - 1, h: TRACK })
    }
    return y
  }
  interface End { box: Box; lane: number; header: boolean; row: number }
  const endOf = (id: string): End | null => {
    const node = byId.get(id)
    if (node) {
      return { box: node, lane: laneIndex.get(id) ?? 0, header: false, row: Math.max(0, rowByModel.get(id) ?? 0) }
    }
    const lane = laneOrder.indexOf(id)
    return lane < 0 ? null : { box: { x: laneX(lane) + PAD, y: HEADER_Y, w: NODE_W, h: HEADER_H }, lane, header: true, row: 0 }
  }
  const labelSize = (e: DiagramEdge) => {
    const w = Math.max(0, ...(e.labelLines ?? []).map(l => textWidth(l, EDGE_LABEL_FONT)), ...(e.conditionLines ?? []).map(l => textWidth(l, EDGE_LABEL_FONT) + PILL_PAD))
    return { w: w + LABEL_PAD, h: labelHeight(lineCount(e)) }
  }
  const rowByModel = new Map(order.map(id => [modelId(id), isLaneEndpoint(id) ? -1 : rowOf.get(id) ?? -1]))
  const bands = new Map<number, number>()
  const detourY = (row: number, h: number) => {
    const start = bands.get(row) ?? (row < 0 ? HEADER_Y + HEADER_H + LABEL_MARGIN : (rowY[row] ?? top) + (rowH[row] ?? 0) + LABEL_MARGIN + (directLabelH.get(row) ?? 0) + LABEL_MARGIN)
    bands.set(row, start + h + 2 * LABEL_MARGIN)
    return start + LABEL_MARGIN + h / 2
  }
  const route = (a: End, b: End, drop: number | null): { points: RoutePoint[]; gutter: number | null } => {
    const port = (box: Box, share: number) => box.y + box.h * share
    if (a.lane === b.lane) {
      const ya = port(a.box, PORT.outRight)
      const yb = port(b.box, PORT.inRight)
      const between = nodes.some(n => n !== a.box && n !== b.box && laneIndex.get(n.id) === a.lane && n.y > Math.min(a.box.y, b.box.y) && n.y < Math.max(a.box.y, b.box.y))
      if (!a.header && !b.header && b.box.y > a.box.y && !between) {
        const x = a.box.x + a.box.w / 2
        return { points: [{ x, y: a.box.y + a.box.h }, { x, y: b.box.y }], gutter: null }
      }
      const gx = trackX(a.lane)
      if (drop !== null) {
        const gx2 = trackX(a.lane)
        return { points: [{ x: a.box.x + a.box.w, y: ya }, { x: gx, y: ya }, { x: gx, y: drop }, { x: gx2, y: drop }, { x: gx2, y: yb }, { x: b.box.x + b.box.w, y: yb }], gutter: a.lane }
      }
      return { points: [{ x: a.box.x + a.box.w, y: ya }, { x: gx, y: ya }, { x: gx, y: yb }, { x: b.box.x + b.box.w, y: yb }], gutter: a.lane }
    }
    const right = b.lane > a.lane
    const ya = port(a.box, right ? PORT.outRight : PORT.outLeft)
    const yb = port(b.box, right ? PORT.inLeft : PORT.inRight)
    const first = right ? a.lane : a.lane - 1
    const last = right ? b.lane - 1 : b.lane
    const start = right ? a.box.x + a.box.w : a.box.x
    const end = right ? b.box.x : b.box.x + b.box.w
    const x1 = trackX(first)
    if (first === last && drop !== null) {
      const x2 = trackX(first)
      return { points: [{ x: start, y: ya }, { x: x1, y: ya }, { x: x1, y: drop }, { x: x2, y: drop }, { x: x2, y: yb }, { x: end, y: yb }], gutter: first }
    }
    if (first === last) {
      return { points: [{ x: start, y: ya }, { x: x1, y: ya }, { x: x1, y: yb }, { x: end, y: yb }], gutter: first }
    }
    const x2 = trackX(last)
    const channel = drop ?? channelY(b.row)
    return { points: [{ x: start, y: ya }, { x: x1, y: ya }, { x: x1, y: channel }, { x: x2, y: channel }, { x: x2, y: yb }, { x: end, y: yb }], gutter: first }
  }

  const routed = edges.flatMap(e => {
    const a = endOf(e.from)
    const b = endOf(e.to)
    if (!a || !b) {
      return []
    }
    const r = route(a, b, detours.has(e.id) ? detourY(rowByModel.get(e.from) ?? -1, labelSize(e).h) : null)
    e.route = r.points
    return [{ edge: e, source: a.box, gutter: r.gutter }]
  })
  const arrows = routed.flatMap(({ edge }) => {
    const box = arrowBox(edge.route ?? [])
    return box ? [box] : []
  })
  const placed: Box[] = []
  const stackBottom = new Map<Box, number>()
  for (const { edge, source } of routed.filter(r => r.gutter === null && (r.edge.label || r.edge.condition))) {
    const { w, h } = labelSize(edge)
    const y = stackBottom.get(source) ?? source.y + source.h + LABEL_MARGIN
    edge.labelBox = { x: Math.max(0, source.x + source.w / 2 - w / 2), y, w, h }
    stackBottom.set(source, y + h + LABEL_MARGIN)
    placed.push(edge.labelBox)
  }
  const lastLane = laneOrder.length - 1
  const width = Math.max(0, laneX(lastLane) + LANE_W + (tracks.has(lastLane) ? gutterW(lastLane) : 0))
  const headers = laneOrder.map((_, i) => ({ x: laneX(i), y: 0, w: LANE_W, h: HEADER_Y + HEADER_H }))
  const blocked = (box: Box) => box.x < 0 || box.x + box.w > width || box.y < 0 || [...placed, ...arrows, ...nodes, ...headers].some(o => overlaps(box, o))
  const gutterLabels = routed
    .filter(r => r.gutter !== null && (r.edge.label || r.edge.condition))
    .map(r => ({ ...r, anchor: r.edge.route?.[1] ?? { x: 0, y: 0 }, length: routeLength(r.edge.route ?? []) }))
    .sort((p, q) => p.length - q.length || p.anchor.y - q.anchor.y)
  for (const { edge, anchor } of gutterLabels) {
    const { w, h } = labelSize(edge)
    const at = (p: RoutePoint): Box => ({ x: p.x - w / 2, y: p.y - h / 2, w, h })
    const spot = pointsAlong(edge.route ?? [])
      .sort((p, q) => Math.hypot(p.x - anchor.x, p.y - anchor.y) - Math.hypot(q.x - anchor.x, q.y - anchor.y))
      .find(p => !blocked(at(p)))
    if (!spot) {
      crowded.push({ row: rowByModel.get(edge.from) ?? -1, h: h + 2 * LABEL_MARGIN, edge: edge.id })
    }
    let box = at(spot ?? anchor)
    const obstacles = [...placed, ...arrows]
    for (let hit = spot ? undefined : obstacles.find(o => overlaps(box, o)); hit; hit = obstacles.find(o => overlaps(box, o))) {
      box = { ...box, y: hit.y + hit.h + LABEL_MARGIN }
    }
    edge.labelBox = box
    placed.push(box)
  }

  const bottom = Math.max(height, ...placed.map(b => b.y + b.h + PAD))
  const groups: DiagramGroup[] = laneOrder.map((lane, i) => ({
    id: lane, kind: 'lane', label: fitLabel(laneLabel(lane), LANE_W, FONT), fontSize: FONT,
    members: order.filter(id => !isLaneEndpoint(id) && laneOf(id) === lane).map(modelId),
    x: laneX(i), y: 0, w: LANE_W, h: bottom,
  }))
  return {
    model: {
      id: `flow:${flow.id}`, title: `${flow.name} — swimlanes`, width, height: bottom,
      nodes, groups, edges, renderers: ALL_RENDERERS,
    },
    crowded,
    overflow,
  }
}

function routeLength(route: RoutePoint[]): number {
  return route.slice(1).reduce((sum, q, i) => sum + Math.abs(q.x - (route[i]?.x ?? q.x)) + Math.abs(q.y - (route[i]?.y ?? q.y)), 0)
}

function pointsAlong(route: RoutePoint[]): RoutePoint[] {
  return route.slice(1).flatMap((q, i) => {
    const p = route[i] ?? q
    const steps = Math.max(1, Math.round(Math.hypot(q.x - p.x, q.y - p.y) / LABEL_STEP))
    return Array.from({ length: steps + 1 }, (_, k) => ({ x: p.x + ((q.x - p.x) * k) / steps, y: p.y + ((q.y - p.y) * k) / steps }))
  })
}

export function arrowBox(route: RoutePoint[]): Box | null {
  const q = route[route.length - 1]
  const p = route[route.length - 2]
  if (!p || !q) {
    return null
  }
  const tail = { x: q.x - Math.sign(q.x - p.x) * ARROW, y: q.y - Math.sign(q.y - p.y) * ARROW }
  return {
    x: Math.min(q.x, tail.x) - ARROW_CLEARANCE,
    y: Math.min(q.y, tail.y) - ARROW_CLEARANCE,
    w: Math.abs(q.x - tail.x) + 2 * ARROW_CLEARANCE,
    h: Math.abs(q.y - tail.y) + 2 * ARROW_CLEARANCE,
  }
}

export function chapterFocus(model: DiagramModel, flow: ServiceFlow, refs: string[]): Set<string> {
  const units = new Set((flow.codeUnits ?? []).map(u => u.id))
  const stores = new Set((flow.infraNodes ?? []).map(n => n.id))
  const nodeIds = new Set(model.nodes.map(n => n.id))
  const focus = new Set<string>()
  for (const ref of refs) {
    if (units.has(ref)) {
      focus.add(unitNodeId(ref))
      continue
    }
    if (stores.has(ref)) {
      focus.add(infraNodeId(ref))
      continue
    }
    const name = ref.replace(/ \([^)]*\)$/, '')
    if (nodeIds.has(serviceNodeId(name))) {
      focus.add(serviceNodeId(name))
      continue
    }
    for (const lane of model.groups.filter(g => g.id === requestLane(name) || g.id === backgroundLane(name))) {
      focus.add(lane.id)
      if (name === ref) {
        lane.members.forEach(m => focus.add(m))
      }
    }
  }
  return focus
}
