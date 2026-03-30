import { MarkerType } from '@xyflow/react'
import type { Node, Edge } from '@xyflow/react'
import type { ServiceFlow, ServiceFlowStep, ConnectivityMap } from '../types-connectivity'
import type { ServiceNodeData } from './buildConnectivityGraph'
import type { DatabaseNodeData } from '../components/nodes/DatabaseNode'
import { DB_COLORS } from '../components/nodes/DatabaseNode'

const SVC_W = 200
const SVC_H = 60
const INFRA_W = 160
const INFRA_H = 64

const COL_GAP = 320         // horizontal gap between rank columns
const ROW_GAP = 50          // vertical gap between service rows within a column
const INFRA_BELOW_GAP = 36  // gap from bottom of service to first infra node
const INFRA_GAP_Y = 10      // gap between stacked infra nodes

// ── DAG rank computation (longest-path) ──────────────────────────────────────
function computeRanks(steps: ServiceFlowStep[]): Map<string, number> {
  const allNodes = new Set<string>()
  const inEdges = new Map<string, Set<string>>()
  const outEdges = new Map<string, Set<string>>()

  for (const step of steps) {
    allNodes.add(step.from)
    allNodes.add(step.to)
    if (!inEdges.has(step.to)) inEdges.set(step.to, new Set())
    inEdges.get(step.to)!.add(step.from)
    if (!outEdges.has(step.from)) outEdges.set(step.from, new Set())
    outEdges.get(step.from)!.add(step.to)
  }

  // Topological sort (DFS-based)
  const visited = new Set<string>()
  const topoOrder: string[] = []
  function dfs(node: string) {
    if (visited.has(node)) return
    visited.add(node)
    for (const succ of outEdges.get(node) ?? []) dfs(succ)
    topoOrder.unshift(node)
  }
  for (const n of allNodes) dfs(n)

  // Longest-path rank assignment
  const rank = new Map<string, number>()
  for (const n of allNodes) rank.set(n, 0)
  for (const n of topoOrder) {
    for (const succ of outEdges.get(n) ?? []) {
      rank.set(succ, Math.max(rank.get(succ)!, rank.get(n)! + 1))
    }
  }

  return rank
}

/**
 * Builds a ReactFlow node/edge graph for a single ServiceFlow.
 *
 * Layout strategy:
 *   - Services are assigned to rank columns via longest-path through the step DAG.
 *   - Multiple services in the same rank are stacked vertically.
 *   - Infra nodes are stacked below the service they connect from.
 *   - All columns are vertically centred around a common midpoint.
 */
export function buildFlowGraph(
  flow: ServiceFlow,
  map: ConnectivityMap,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  const infraEdges = flow.infraEdges ?? []
  const infraNodes = flow.infraNodes ?? []

  // ── 1. Collect unique service names (visit order for stable ordering) ─────
  const visitOrder: string[] = []
  for (const step of flow.steps) {
    if (!visitOrder.includes(step.from)) visitOrder.push(step.from)
    if (!visitOrder.includes(step.to))   visitOrder.push(step.to)
  }

  // ── 2. Compute DAG ranks ──────────────────────────────────────────────────
  const rankMap = computeRanks(flow.steps)

  // Group services by rank, preserving visit order within each rank
  const byRank = new Map<number, string[]>()
  for (const name of visitOrder) {
    const r = rankMap.get(name) ?? 0
    if (!byRank.has(r)) byRank.set(r, [])
    byRank.get(r)!.push(name)
  }
  const maxRank = Math.max(...byRank.keys())

  // ── 3. Build infra-by-service map ─────────────────────────────────────────
  const infraByService = new Map<string, string[]>()
  for (const ie of infraEdges) {
    if (!visitOrder.includes(ie.from)) continue  // infra→infra edges handled later
    if (!infraByService.has(ie.from)) infraByService.set(ie.from, [])
    infraByService.get(ie.from)!.push(ie.to)
  }

  // Height a service occupies in its column (service box + infra stack below it)
  const slotHeight = (svcName: string): number => {
    const ids = infraByService.get(svcName) ?? []
    if (ids.length === 0) return SVC_H
    return SVC_H + INFRA_BELOW_GAP + ids.length * INFRA_H + (ids.length - 1) * INFRA_GAP_Y
  }

  // Total height of a column (sum of slot heights + row gaps between them)
  const columnHeight = (services: string[]): number =>
    services.reduce((acc, n) => acc + slotHeight(n) + ROW_GAP, -ROW_GAP)

  // Overall canvas height = tallest column; all others are centred inside it
  const canvasHeight = Math.max(...[...byRank.values()].map(columnHeight))

  // ── 4. Position service nodes ──────────────────────────────────────────────
  const svcPositions = new Map<string, { x: number; y: number }>()

  for (const [rank, services] of byRank) {
    const colX = rank * (SVC_W + COL_GAP)
    const colH = columnHeight(services)
    let y = (canvasHeight - colH) / 2  // vertically centre within canvas

    for (const name of services) {
      svcPositions.set(name, { x: colX, y })

      const svc = map.services.find(s => s.name === name)
      nodes.push({
        id: name,
        type: 'serviceNode',
        position: { x: colX, y },
        data: {
          name,
          description: svc?.description ?? name,
          type: svc?.type ?? 'typescript-microservice',
          isSelected: false,
          isCaller: false,
          isCallee: false,
        } satisfies ServiceNodeData,
      })

      y += slotHeight(name) + ROW_GAP
    }
  }

  // ── 5. Position infra nodes below their parent service ────────────────────
  const placedInfraIds = new Set<string>()

  for (const [svcName, ids] of infraByService) {
    const svcPos = svcPositions.get(svcName)
    if (!svcPos) continue

    const baseX = svcPos.x + (SVC_W - INFRA_W) / 2
    const baseY = svcPos.y + SVC_H + INFRA_BELOW_GAP

    ids.forEach((infraId, j) => {
      const infra = infraNodes.find(n => n.id === infraId)
      if (!infra) return
      nodes.push({
        id: infra.id,
        type: 'databaseNode',
        position: { x: baseX, y: baseY + j * (INFRA_H + INFRA_GAP_Y) },
        data: {
          dbType: infra.type,
          name: infra.label,
          description: infra.description ?? '',
        } satisfies DatabaseNodeData,
      })
      placedInfraIds.add(infra.id)
    })
  }

  // Orphan infra nodes (connected from other infra nodes or unmatched)
  const orphans = infraNodes.filter(n => !placedInfraIds.has(n.id))
  orphans.forEach((infra, j) => {
    const baseX = (maxRank + 1) * (SVC_W + COL_GAP)
    nodes.push({
      id: infra.id,
      type: 'databaseNode',
      position: { x: baseX, y: j * (INFRA_H + INFRA_GAP_Y) },
      data: {
        dbType: infra.type,
        name: infra.label,
        description: infra.description ?? '',
      } satisfies DatabaseNodeData,
    })
  })

  // ── 6. Step edges (service → service) ────────────────────────────────────
  // Deduplicate parallel edges between the same pair with aggregated labels
  const pairLabels = new Map<string, string[]>()
  flow.steps.forEach(step => {
    const key = `${step.from}→${step.to}`
    if (!pairLabels.has(key)) pairLabels.set(key, [])
    pairLabels.get(key)!.push(step.action)
  })

  const addedPairs = new Set<string>()
  flow.steps.forEach((step, i) => {
    const key = `${step.from}→${step.to}`
    if (addedPairs.has(key)) return
    addedPairs.add(key)

    const labels = pairLabels.get(key)!
    const label = labels.length === 1 ? labels[0] : labels.map((l, n) => `${n + 1}. ${l}`).join('\n')

    edges.push({
      id: `step-${i}-${key}`,
      source: step.from,
      target: step.to,
      type: 'connectivityEdge',
      label,
      data: {},
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1', width: 14, height: 14 },
      style: { stroke: '#6366f1', strokeWidth: 2 },
      labelStyle: { fill: '#64748b', fontSize: 10 },
      labelBgStyle: { fill: '#1a1d27', fillOpacity: 0.9 },
      labelBgPadding: [4, 3] as [number, number],
    })
  })

  // ── 7. Infra edges ────────────────────────────────────────────────────────
  for (const ie of infraEdges) {
    const meta = infraNodes.find(n => n.id === ie.to)
    const color = meta ? (DB_COLORS[meta.type]?.color ?? '#2e3250') : '#2e3250'
    edges.push({
      id: `infra-${ie.from}-${ie.to}`,
      source: ie.from,
      target: ie.to,
      type: 'floatingDbEdge',
      label: ie.label,
      style: { stroke: color + '88', strokeWidth: 1.5, strokeDasharray: '5 3' },
      markerEnd: { type: MarkerType.ArrowClosed, color: color + '88', width: 10, height: 10 },
      labelStyle: { fill: color + 'aa', fontSize: 9 },
      labelBgStyle: { fill: '#0f1117', fillOpacity: 0.85 },
      labelBgPadding: [3, 2] as [number, number],
    })
  }

  void maxRank // used above for orphan placement

  return { nodes, edges }
}

