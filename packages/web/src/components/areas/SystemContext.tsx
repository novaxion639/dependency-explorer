import { useMemo } from 'react'
import { ReactFlow, Background, BackgroundVariant, Controls, type Edge, type Node, type NodeMouseHandler } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { ConnectivityMap } from '@dependency-explorer/data'
import { buildContextLanes } from '@dependency-explorer/data'

const ROW = 40
const NODE_WIDTH = 190
const LANE_WIDTH = 230
const LANE_COLUMNS = 4
const LANE_GAP = 30
const LANES_X = 480
const NODE_STYLE = { background: '#1a1d27', color: '#e2e8f0', fontSize: 11, width: NODE_WIDTH }

interface Props {
  map: ConnectivityMap
  onSelectService: (name: string) => void
  onOpenArea: (id: string) => void
}

function buildContextGraph(map: ConnectivityMap): { nodes: Node[]; edges: Edge[] } {
  const ctx = buildContextLanes(map)
  const nodes: Node[] = []
  const place = (id: string, label: string, x: number, y: number, border: string) => {
    nodes.push({ id, position: { x, y }, data: { label }, style: { ...NODE_STYLE, border: `1px solid ${border}` } })
  }
  ctx.clients.forEach((s, i) => place(`svc:${s}`, s, 0, i * ROW, '#42b883'))
  ctx.monolith.forEach((s, i) => place(`svc:${s}`, s, 240, i * ROW, '#cc342d'))

  const anchorOf = new Map<string, string>()
  const blocks = [
    ...ctx.lanes.map(l => ({ id: `area:${l.area.id}`, title: `▸ ${l.area.name}`, color: l.area.color, services: l.services })),
    ...(ctx.unlaned.length ? [{ id: 'area:unlaned', title: '▸ No area', color: '#475569', services: ctx.unlaned }] : []),
  ]
  let rowTop = 0
  for (let start = 0; start < blocks.length; start += LANE_COLUMNS) {
    const row = blocks.slice(start, start + LANE_COLUMNS)
    row.forEach((block, col) => {
      const x = LANES_X + col * LANE_WIDTH
      place(block.id, block.title, x, rowTop, block.color)
      block.services.forEach((s, i) => {
        place(`svc:${s}`, s, x, rowTop + (i + 1) * ROW, block.color)
        anchorOf.set(`svc:${s}`, block.id)
      })
    })
    rowTop += (Math.max(...row.map(b => b.services.length)) + 1) * ROW + LANE_GAP
  }
  const sideX = LANES_X + LANE_COLUMNS * LANE_WIDTH + 40
  ctx.stores.forEach((t, i) => place(`store:${t}`, t, sideX, i * ROW, '#f59e0b'))
  ctx.externals.forEach((e, i) => place(`ext:${e.id}`, `${e.name} · ${e.category}`, sideX + 240, i * ROW, '#a78bfa'))

  const placed = new Set(nodes.map(n => n.id))
  const seen = new Set<string>()
  const edges: Edge[] = []
  const link = (from: string, to: string, dashed: boolean) => {
    const source = anchorOf.get(from) ?? from
    const target = anchorOf.get(to) ?? to
    const id = `${source}->${target}`
    if (source !== target && placed.has(source) && placed.has(target) && !seen.has(id)) {
      seen.add(id)
      edges.push({ id, source, target, style: { stroke: '#334155', strokeDasharray: dashed ? '4 3' : undefined } })
    }
  }
  for (const c of map.connections) {
    link(`svc:${c.from}`, `svc:${c.to}`, c.communicationType === 'async')
  }
  for (const svc of map.services) {
    for (const db of svc.databases ?? []) {
      link(`svc:${svc.name}`, `store:${db.type}`, false)
    }
  }
  for (const e of ctx.externals) {
    for (const u of e.usedBy) {
      link(`svc:${u.service}`, `ext:${e.id}`, true)
    }
  }
  return { nodes, edges }
}

export function SystemContext({ map, onSelectService, onOpenArea }: Props) {
  const { nodes, edges } = useMemo(() => buildContextGraph(map), [map])

  const onNodeClick: NodeMouseHandler = (_, node) => {
    if (node.id.startsWith('svc:')) {
      onSelectService(node.id.slice('svc:'.length))
    } else if (node.id.startsWith('area:')) {
      onOpenArea(node.id.slice('area:'.length))
    }
  }

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        minZoom={0.2}
        nodesConnectable={false}
        onNodeClick={onNodeClick}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1e2235" />
        <Controls style={{ background: '#1a1d27', border: '1px solid #2e3250', borderRadius: 8 }} />
      </ReactFlow>
      <div style={{ position: 'absolute', top: 12, left: 12, background: '#1a1d27', border: '1px solid #2e3250', borderRadius: 6, padding: '6px 10px', fontSize: 10, color: '#64748b' }}>
        Clients · Monolith · Services by area (edges drawn per area) · Data stores · External systems — dashed = async / third party
      </div>
    </div>
  )
}
