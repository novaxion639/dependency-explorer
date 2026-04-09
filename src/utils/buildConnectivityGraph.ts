import { MarkerType } from '@xyflow/react'
import type { Node, Edge } from '@xyflow/react'
import type { ConnectivityMap } from '../data/schemas'
import type { DatabaseNodeData } from '../components/nodes/DatabaseNode'

const NODE_W = 200
const NODE_H = 60
const DB_NODE_W = 160
const DB_NODE_H = 64

export interface ServiceNodeData {
  name: string
  description: string
  type: string
  isSelected: boolean
  isCaller: boolean
  isCallee: boolean
  [key: string]: unknown
}

export function buildConnectivityGraph(
  map: ConnectivityMap,
  selectedService: string | null,
): { nodes: Node[]; edges: Edge[] } {
  if (!selectedService) return { nodes: [], edges: [] }

  // Find all direct connections involving the selected service
  const outgoing = map.connections.filter(c => c.from === selectedService)
  const incoming = map.connections.filter(c => c.to === selectedService)

  const calleeNames = new Set(outgoing.map(c => c.to))
  const callerNames = new Set(incoming.map(c => c.from))

  // All service names that appear in the neighbourhood
  const allNames = new Set([selectedService, ...calleeNames, ...callerNames])

  // Layout: callers on left, selected in center, callees on right
  const CENTER_X = 500
  const DB_RIGHT_GAP = 20  // horizontal gap between service right edge and first DB node
  const DB_GAP_Y = 10

  // Compute max DB count per column to size gaps correctly
  const maxDbsInColumn = (names: string[]) =>
    Math.max(0, ...names.map(n => map.services.find(s => s.name === n)?.databases?.length ?? 0))
  const maxCallerDbs   = maxDbsInColumn([...callerNames])
  const maxCalleeDbs   = maxDbsInColumn([...calleeNames])
  const maxSelectedDbs = map.services.find(s => s.name === selectedService)?.databases?.length ?? 0
  const maxSideDbs     = Math.max(maxCallerDbs, maxCalleeDbs, maxSelectedDbs)

  // GAP_X: wide enough that DB nodes (placed to the right of their service) don't reach the next column
  // NODE_W(200) + DB_RIGHT_GAP(20) + DB_NODE_W(160) + column_margin(60) = 440
  const GAP_X = maxSideDbs > 0 ? 440 : 320

  // GAP_Y: tall enough that stacked DB nodes in the same column don't overlap between rows
  const dbStackForGap = maxSideDbs > 0
    ? maxSideDbs * DB_NODE_H + (maxSideDbs - 1) * DB_GAP_Y + 10
    : 0
  const GAP_Y = Math.max(90, Math.max(NODE_H, dbStackForGap) + 20)

  const callers = [...callerNames]
  const callees = [...calleeNames]

  const nodes: Node[] = []
  const edges: Edge[] = []

  // Position center node
  const centerY = Math.max(callers.length, callees.length, 1) * GAP_Y / 2

  nodes.push({
    id: selectedService,
    type: 'serviceNode',
    position: { x: CENTER_X, y: centerY - NODE_H / 2 },
    data: {
      name: selectedService,
      description: map.services.find(s => s.name === selectedService)?.description ?? '',
      type: map.services.find(s => s.name === selectedService)?.type ?? '',
      isSelected: true,
      isCaller: false,
      isCallee: false,
    } satisfies ServiceNodeData,
  })

  // Position caller nodes (left column)
  callers.forEach((name, i) => {
    const y = i * GAP_Y + (Math.max(callers.length, 1) - callers.length) * GAP_Y / 2
    nodes.push({
      id: name,
      type: 'serviceNode',
      position: { x: CENTER_X - GAP_X, y: y },
      data: {
        name,
        description: map.services.find(s => s.name === name)?.description ?? '',
        type: map.services.find(s => s.name === name)?.type ?? '',
        isSelected: false,
        isCaller: true,
        isCallee: false,
      } satisfies ServiceNodeData,
    })
  })

  // Position callee nodes (right column)
  callees.forEach((name, i) => {
    const y = i * GAP_Y + (Math.max(callees.length, 1) - callees.length) * GAP_Y / 2
    nodes.push({
      id: name,
      type: 'serviceNode',
      position: { x: CENTER_X + GAP_X, y: y },
      data: {
        name,
        description: map.services.find(s => s.name === name)?.description ?? '',
        type: map.services.find(s => s.name === name)?.type ?? '',
        isSelected: false,
        isCaller: false,
        isCallee: true,
      } satisfies ServiceNodeData,
    })
  })

  // Handle services that are BOTH callers and callees — deduplicate
  for (const node of nodes) {
    const isAlsoCaller = callerNames.has(node.id) && calleeNames.has(node.id)
    if (isAlsoCaller && node.id !== selectedService) {
      // Place in the middle horizontally
      node.position.x = CENTER_X
      ;(node.data as ServiceNodeData).isCaller = true
      ;(node.data as ServiceNodeData).isCallee = true
    }
  }

  // Build edges
  for (const conn of outgoing) {
    if (!allNames.has(conn.to)) continue
    edges.push({
      id: `${conn.from}→${conn.to}`,
      source: conn.from,
      target: conn.to,
      type: 'connectivityEdge',
      data: { connection: conn },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#4f6ef7', width: 14, height: 14 },
      style: { stroke: '#4f6ef7', strokeWidth: 2 },
    })
  }

  for (const conn of incoming) {
    if (!allNames.has(conn.from)) continue
    edges.push({
      id: `${conn.from}→${conn.to}`,
      source: conn.from,
      target: conn.to,
      type: 'connectivityEdge',
      data: { connection: conn },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#818cf8', width: 14, height: 14 },
      style: { stroke: '#818cf8', strokeWidth: 2 },
    })
  }

  // Add database nodes stacked to the right of each service node
  for (const svcNode of [...nodes]) {
    if (svcNode.type !== 'serviceNode') continue
    const svc = map.services.find(s => s.name === svcNode.id)
    if (!svc?.databases?.length) continue

    svc.databases.forEach((db, i) => {
      const dbId = `db:${svcNode.id}:${db.type}:${i}`
      const dbX = svcNode.position.x + NODE_W + DB_RIGHT_GAP
      const dbY = svcNode.position.y + i * (DB_NODE_H + DB_GAP_Y)

      nodes.push({
        id: dbId,
        type: 'databaseNode',
        position: { x: dbX, y: dbY },
        data: {
          dbType: db.type,
          name: db.name,
          description: db.description,
        } satisfies DatabaseNodeData,
      })

      edges.push({
        id: `edge:${svcNode.id}→${dbId}`,
        source: svcNode.id,
        target: dbId,
        type: 'floatingDbEdge',
        style: { stroke: '#2e3250', strokeWidth: 1.5, strokeDasharray: '4 3' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#2e3250', width: 10, height: 10 },
      })
    })
  }

  return { nodes, edges }
}

export { NODE_W, NODE_H, DB_NODE_W, DB_NODE_H }
