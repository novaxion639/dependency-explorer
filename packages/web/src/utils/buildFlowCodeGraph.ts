import { MarkerType } from '@xyflow/react'
import type { Node, Edge } from '@xyflow/react'
import type { ServiceFlow, FlowCodeEdge, ConnectivityMap } from '@dependency-explorer/data'
import type { ServiceNodeData } from './buildConnectivityGraph'
import type { DatabaseNodeData } from '../components/nodes/DatabaseNode'
import type { CodeUnitNodeData, CodeGroupNodeData } from '../components/nodes/CodeUnitNode'
import { DB_COLORS } from '../components/nodes/DatabaseNode'

const UNIT_W = 230
const UNIT_H = 100
const SVC_W = 200
const SVC_H = 140
const INFRA_W = 200
const INFRA_H = 130
const COL_GAP = 130
const ROW_GAP = 46

// Vertical bands keep plain services clear of the code-group rectangle
const SERVICE_BAND_Y = 0
const UNIT_BAND_Y = 230
const GROUP_PAD = 34

const MODE_STYLE: Record<NonNullable<FlowCodeEdge['mode']>, { color: string; dash?: string }> = {
  'sync':        { color: '#6366f1' },
  'async-job':   { color: '#e0761b', dash: '7 4' },
  'async-event': { color: '#f59e0b', dash: '2 4' },
}

/**
 * Code-detail rendering of a flow: codeUnits become nodes grouped inside a
 * container per owning service; plain services and infra participate as
 * ordinary nodes. The topology comes EXCLUSIVELY from codeEdges (the steps
 * array is the macro/services view).
 */
export function buildFlowCodeGraph(
  flow: ServiceFlow,
  map: ConnectivityMap,
): { nodes: Node[]; edges: Edge[] } {
  const units = flow.codeUnits ?? []
  const codeEdges = flow.codeEdges ?? []
  const infraNodes = flow.infraNodes ?? []
  const unitById = new Map(units.map(u => [u.id, u]))
  const infraById = new Map(infraNodes.map(n => [n.id, n]))

  // ── Node universe + classification ─────────────────────────────────────────
  const visitOrder: string[] = []
  const seen = new Set<string>()
  const visit = (id: string) => {
    if (!seen.has(id)) { seen.add(id); visitOrder.push(id) }
  }
  for (const u of units) visit(u.id)
  for (const e of codeEdges) { visit(e.from); visit(e.to) }

  // ── Longest-path ranks over the code-edge DAG ──────────────────────────────
  const out = new Map<string, Set<string>>()
  for (const e of codeEdges) {
    if (!out.has(e.from)) out.set(e.from, new Set())
    out.get(e.from)!.add(e.to)
  }
  const visited = new Set<string>()
  const topo: string[] = []
  const dfs = (n: string) => {
    if (visited.has(n)) return
    visited.add(n)
    for (const s of out.get(n) ?? []) dfs(s)
    topo.unshift(n)
  }
  for (const n of visitOrder) dfs(n)
  const rank = new Map<string, number>(visitOrder.map(n => [n, 0]))
  for (const n of topo) {
    for (const s of out.get(n) ?? []) {
      rank.set(s, Math.max(rank.get(s) ?? 0, (rank.get(n) ?? 0) + 1))
    }
  }

  // ── Position: x by rank, y by band (services top, units middle, infra follows units) ──
  const colWidth = Math.max(UNIT_W, SVC_W, INFRA_W) + COL_GAP
  const stackInCol = new Map<number, number>() // rank → next y offset inside the unit/infra band
  const positions = new Map<string, { x: number; y: number }>()
  const svcStack = new Map<number, number>()

  for (const id of visitOrder) {
    const r = rank.get(id) ?? 0
    const x = r * colWidth
    if (unitById.has(id) || infraById.has(id)) {
      const yOff = stackInCol.get(r) ?? 0
      const h = unitById.has(id) ? UNIT_H : INFRA_H
      positions.set(id, { x, y: UNIT_BAND_Y + yOff })
      stackInCol.set(r, yOff + h + ROW_GAP)
    } else {
      const yOff = svcStack.get(r) ?? 0
      positions.set(id, { x, y: SERVICE_BAND_Y + yOff })
      svcStack.set(r, yOff + SVC_H + ROW_GAP)
    }
  }

  const nodes: Node[] = []
  const edges: Edge[] = []

  // ── Group containers (parents must precede children in the nodes array) ────
  const unitsByService = new Map<string, string[]>()
  for (const u of units) {
    if (!unitsByService.has(u.service)) unitsByService.set(u.service, [])
    unitsByService.get(u.service)!.push(u.id)
  }
  const groupOrigin = new Map<string, { x: number; y: number }>()
  for (const [service, ids] of unitsByService) {
    const xs = ids.map(id => positions.get(id)!.x)
    const ys = ids.map(id => positions.get(id)!.y)
    const minX = Math.min(...xs) - GROUP_PAD
    const minY = Math.min(...ys) - GROUP_PAD
    const maxX = Math.max(...xs) + UNIT_W + GROUP_PAD
    const maxY = Math.max(...ys) + UNIT_H + GROUP_PAD
    groupOrigin.set(service, { x: minX, y: minY })
    nodes.push({
      id: `group-${service}`,
      type: 'codeGroupNode',
      position: { x: minX, y: minY },
      style: { width: maxX - minX, height: maxY - minY, zIndex: -1 },
      data: { serviceName: service } satisfies CodeGroupNodeData,
      draggable: false,
      selectable: false,
    })
  }

  // ── Concrete nodes ──────────────────────────────────────────────────────────
  for (const id of visitOrder) {
    const pos = positions.get(id)!
    const unit = unitById.get(id)
    if (unit) {
      const svc = map.services.find(s => s.name === unit.service)
      const codeUrl = svc?.repoUrl && unit.path ? `${svc.repoUrl}/blob/master/${unit.path}` : undefined
      const origin = groupOrigin.get(unit.service)
      nodes.push({
        id,
        type: 'codeUnitNode',
        position: origin ? { x: pos.x - origin.x, y: pos.y - origin.y } : pos,
        parentId: origin ? `group-${unit.service}` : undefined,
        extent: origin ? 'parent' : undefined,
        data: { unit, codeUrl } satisfies CodeUnitNodeData,
      })
      continue
    }
    const infra = infraById.get(id)
    if (infra) {
      nodes.push({
        id,
        type: 'databaseNode',
        position: pos,
        data: {
          dbType: infra.type,
          name: infra.label,
          description: infra.description ?? '',
        } satisfies DatabaseNodeData,
      })
      continue
    }
    const svc = map.services.find(s => s.name === id)
    nodes.push({
      id,
      type: 'serviceNode',
      position: pos,
      data: {
        name: id,
        description: svc?.description ?? id,
        type: svc?.type ?? 'typescript-microservice',
        isSelected: false,
        isCaller: false,
        isCallee: false,
      } satisfies ServiceNodeData,
    })
  }

  // ── Edges with call semantics ───────────────────────────────────────────────
  codeEdges.forEach((e, i) => {
    const mode = e.mode ?? 'sync'
    const { color, dash } = MODE_STYLE[mode]
    const isInfraTarget = infraById.has(e.to)
    const infraColor = isInfraTarget
      ? (DB_COLORS[infraById.get(e.to)!.type]?.color ?? color)
      : color
    const stroke = isInfraTarget ? infraColor + '99' : color

    const crudSuffix = e.crud?.length ? ` [${e.crud.map(c => c[0]!.toUpperCase()).join('')}]` : ''
    const parts = [
      (e.inTransaction ? '⟳ ' : '') + (e.label ?? '') + crudSuffix,
      e.condition ? `⚑ ${e.condition}` : null,
    ].filter(Boolean)

    edges.push({
      id: `code-${i}-${e.from}-${e.to}`,
      source: e.from,
      target: e.to,
      type: isInfraTarget || infraById.has(e.from) ? 'floatingDbEdge' : 'connectivityEdge',
      label: parts.join('\n'),
      data: { failure: e.failure },
      markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 12, height: 12 },
      style: { stroke, strokeWidth: 1.8, ...(dash ? { strokeDasharray: dash } : {}) },
      labelStyle: { fill: '#94a3b8', fontSize: 9 },
      labelBgStyle: { fill: '#0f1117', fillOpacity: 0.9 },
      labelBgPadding: [4, 3] as [number, number],
      zIndex: 10,
    })
  })

  return { nodes, edges }
}
