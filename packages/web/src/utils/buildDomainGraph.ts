import { MarkerType } from '@xyflow/react'
import type { Node, Edge } from '@xyflow/react'
import type { ConnectivityMap } from '@dependency-explorer/data'
import type { DomainNodeData } from '../components/nodes/DomainNode'

const COLS = 3
const COL_GAP = 340
const ROW_GAP = 200

export function buildDomainGraph(
  map: ConnectivityMap,
): { nodes: Node[]; edges: Edge[] } {
  const domains = map.domains ?? []
  if (domains.length === 0) return { nodes: [], edges: [] }

  // Build domain service set for fast lookup
  const serviceToDomain = new Map<string, string>()
  for (const domain of domains) {
    for (const svcName of domain.serviceNames) {
      serviceToDomain.set(svcName, domain.id)
    }
  }

  // Build nodes in a grid layout
  const nodes: Node[] = domains.map((domain, i) => {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    return {
      id: `domain:${domain.id}`,
      type: 'domainNode',
      position: { x: col * COL_GAP + 50, y: row * ROW_GAP + 50 },
      data: {
        id: domain.id,
        name: domain.name,
        description: domain.description,
        color: domain.color,
        serviceCount: domain.serviceNames.length,
        dataEntities: domain.dataEntities,
      } satisfies DomainNodeData,
    }
  })

  // Build cross-domain edges (aggregate connections between domains)
  const crossDomainCounts = new Map<string, number>()
  for (const conn of map.connections) {
    const fromDomain = serviceToDomain.get(conn.from)
    const toDomain = serviceToDomain.get(conn.to)
    if (!fromDomain || !toDomain || fromDomain === toDomain) continue
    const key = `${fromDomain}→${toDomain}`
    crossDomainCounts.set(key, (crossDomainCounts.get(key) ?? 0) + 1)
  }

  const edges: Edge[] = []
  for (const [key, count] of crossDomainCounts) {
    const [fromId, toId] = key.split('→')
    const fromDomain = domains.find(d => d.id === fromId)
    const toDomain = domains.find(d => d.id === toId)
    if (!fromDomain || !toDomain) continue

    edges.push({
      id: `domain-edge:${key}`,
      source: `domain:${fromId}`,
      target: `domain:${toId}`,
      type: 'default',
      label: `${count} connection${count !== 1 ? 's' : ''}`,
      labelStyle: { fontSize: 10, fill: '#64748b', fontWeight: 600 },
      labelBgStyle: { fill: '#1a1d27', fillOpacity: 0.9 },
      labelBgPadding: [4, 6] as [number, number],
      labelBgBorderRadius: 4,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#4f6ef766', width: 12, height: 12 },
      style: { stroke: '#4f6ef766', strokeWidth: 1.5 },
    })
  }

  return { nodes, edges }
}
