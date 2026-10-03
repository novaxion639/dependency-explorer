import type { FlowCodeEdge, FlowCodeUnit, ServiceFlow } from '@dependency-explorer/data'
import { fitLabel, linesHeight } from '../geometry'
import { ALL_RENDERERS, type DiagramEdge, type DiagramGroup, type DiagramModel, type DiagramNode, type EdgeMode } from '../model'

const FONT = 12
const LANE_W = 250
const LANE_GAP = 16
const PAD = 12
const HEAD = 32
const ROW_GAP = 22
const NODE_W = LANE_W - 2 * PAD
const LABEL_MAX = 34

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

export function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function edgeText(label: string | undefined, crud: string[] | undefined): string {
  const letters = crud?.length ? ` [${crud.map(c => c.slice(0, 1).toUpperCase()).join('')}]` : ''
  return `${clip(label ?? '', LABEL_MAX)}${letters}`.trim()
}

function edgeCondition(e: FlowCodeEdge): string | undefined {
  if (e.condition) {
    return e.condition
  }
  return e.flags?.length ? `🚩 ${e.flags.map(f => f.name).join(', ')}` : undefined
}

export function swimlanes(flow: ServiceFlow): DiagramModel {
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
  const modelId = (id: string) => (units.has(id) ? unitNodeId(id) : infra.has(id) ? infraNodeId(id) : isLaneEndpoint(id) ? requestLane(id) : serviceNodeId(id))

  const rows = Math.max(0, ...rowOf.values()) + 1
  const rowH = Array.from({ length: rows }, (_, r) => Math.max(0, ...order.filter(id => rowOf.get(id) === r).map(id => byId.get(modelId(id))?.h ?? 0)))
  const rowY: number[] = []
  rowH.reduce((y, h, r) => {
    rowY[r] = y
    return y + h + ROW_GAP
  }, HEAD)
  const height = HEAD + rowH.reduce((sum, h) => sum + h + ROW_GAP, 0) + PAD
  for (const id of order) {
    const node = byId.get(modelId(id))
    const row = rowOf.get(id)
    if (node && row !== undefined) {
      node.x = laneOrder.indexOf(laneOf(id)) * (LANE_W + LANE_GAP) + PAD
      node.y = rowY[row] ?? HEAD
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
  const groups: DiagramGroup[] = laneOrder.map((lane, i) => ({
    id: lane, kind: 'lane', label: fitLabel(laneLabel(lane), LANE_W, FONT), fontSize: FONT,
    members: order.filter(id => !isLaneEndpoint(id) && laneOf(id) === lane).map(modelId),
    x: i * (LANE_W + LANE_GAP), y: 0, w: LANE_W, h: height,
  }))

  const edges: DiagramEdge[] = []
  const push = (from: string, to: string, mode: EdgeMode, label: string, condition?: string) => {
    const a = modelId(from)
    const b = modelId(to)
    if (a === b) {
      return
    }
    edges.push({ id: `e${edges.length}:${a}>${b}`, from: a, to: b, mode, weight: 1, label, directed: true, lane: 0, lanes: 1, ...(condition ? { condition: clip(condition, LABEL_MAX + 6) } : {}) })
  }
  for (const e of codeEdges) {
    const mode: EdgeMode = infra.has(e.from) ? 'data-feed' : e.mode === 'async-job' || e.mode === 'async-event' ? 'async' : 'sync'
    push(e.from, e.to, mode, edgeText(e.label, e.crud), edgeCondition(e))
  }
  for (const e of infraLinks) {
    push(e.from, e.to, 'sync', edgeText(e.label, e.crud))
  }
  return {
    id: `flow:${flow.id}`, title: `${flow.name} — swimlanes`, width: laneOrder.length * (LANE_W + LANE_GAP) - LANE_GAP, height,
    nodes, groups, edges, renderers: ALL_RENDERERS,
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
