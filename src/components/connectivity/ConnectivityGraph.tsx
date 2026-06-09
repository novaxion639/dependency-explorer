import { useCallback, useEffect, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type EdgeMouseHandler,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { buildConnectivityGraph } from '../../utils/buildConnectivityGraph'
import { ServiceNode } from '../nodes/ServiceNode'
import { DatabaseNode, DB_COLORS } from '../nodes/DatabaseNode'
import type { DatabaseType } from '../../data/schemas'
import { ConnectivityEdge } from './ConnectivityEdge'
import { FloatingDbEdge } from './FloatingDbEdge'
import { EdgePopup } from './EdgePopup'
import { EndpointDrawer } from './EndpointDrawer'
import type { ConnectivityMap, ServiceConnection, ServiceEndpoint } from '../../data/schemas'

const nodeTypes = { serviceNode: ServiceNode, databaseNode: DatabaseNode }
const edgeTypes = { connectivityEdge: ConnectivityEdge, floatingDbEdge: FloatingDbEdge }

interface PopupState {
  connection: ServiceConnection
  position: { x: number; y: number }
}

interface DrawerState {
  serviceName: string
  endpoints: ServiceEndpoint[]
}

interface Props {
  map: ConnectivityMap
  selectedService: string | null
  onSelectService: (name: string) => void
  onOpenFlows: (serviceName: string) => void
  blastRadius?: Map<string, number> | null
}

function FlowInner({ map, selectedService, onOpenFlows, blastRadius }: Props) {
  const { fitView } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [popup, setPopup] = useState<PopupState | null>(null)
  const [drawer, setDrawer] = useState<DrawerState | null>(null)

  useEffect(() => {
    const { nodes: n, edges: e } = buildConnectivityGraph(map, selectedService)

    // Apply blast radius highlighting
    if (blastRadius && blastRadius.size > 0) {
      for (const node of n) {
        if (node.type !== 'serviceNode') continue
        const distance = blastRadius.get(node.id)
        if (distance != null) {
          const opacity = Math.max(0.3, 1 - distance * 0.25)
          ;(node.data as Record<string, unknown>).blastDistance = distance
          node.style = { ...node.style, opacity, filter: `drop-shadow(0 0 ${6 - distance}px #ef4444)` }
        }
      }
    }

    setNodes(n)
    setEdges(e)
    setPopup(null)
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50)
  }, [map, selectedService, blastRadius, setNodes, setEdges, fitView])

  const onEdgeClick: EdgeMouseHandler = useCallback(
    (evt, edge) => {
      evt.stopPropagation()
      const conn = (edge.data as { connection: ServiceConnection } | undefined)?.connection
      if (!conn) return
      setPopup({
        connection: conn,
        position: { x: evt.clientX + 10, y: evt.clientY + 10 },
      })
    },
    [],
  )

  const onNodeClick: NodeMouseHandler = useCallback(
    (_evt, node) => {
      if (node.type === 'databaseNode') return
      // Always open the flows modal on click — sidebar handles selection
      onOpenFlows(node.id)
    },
    [onOpenFlows],
  )

  const onPaneClick = useCallback(() => setPopup(null), [])

  return (
    <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onEdgeClick={onEdgeClick}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          fitView
          minZoom={0.1}
          maxZoom={2}
          nodesDraggable
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1e2235" />
          <Controls style={{ background: '#1a1d27', border: '1px solid #2e3250', borderRadius: 8 }} />
          <MiniMap
            style={{ background: '#0f1117', border: '1px solid #2e3250' }}
            nodeColor={node => {
              if (node.type === 'databaseNode') {
                const dbType = (node.data as { dbType?: DatabaseType }).dbType
                return dbType ? (DB_COLORS[dbType]?.color ?? '#64748b') : '#64748b'
              }
              const d = node.data as { isSelected?: boolean; isCaller?: boolean; isCallee?: boolean; type?: string }
              if (d.isSelected) return d.type === 'vue-frontend' ? '#42b883' : d.type === 'rails-monolith' ? '#cc342d' : '#6366f1'
              if (d.type === 'vue-frontend') return '#42b883'
              if (d.type === 'rails-monolith') return '#cc342d'
              return d.isCaller ? '#818cf8' : '#3b82f6'
            }}
            maskColor="#0f111799"
          />
        </ReactFlow>

        {/* Connection legend */}
        {selectedService && (
          <div style={{
            position: 'absolute', bottom: 12, left: 12, zIndex: 10,
            background: '#1a1d27', border: '1px solid #2e3250', borderRadius: 6,
            padding: '6px 10px', fontSize: 9, color: '#64748b',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="24" height="2"><line x1="0" y1="1" x2="24" y2="1" stroke="#4f6ef7" strokeWidth="2" /></svg>
              <span>Sync (REST)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="24" height="2"><line x1="0" y1="1" x2="24" y2="1" stroke="#e0761b" strokeWidth="2" strokeDasharray="4 2" /></svg>
              <span>Async (SQS/SNS)</span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!selectedService && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: '#3e4363', fontSize: 14, pointerEvents: 'none',
          }}>
            ← Select a microservice to explore its connections
          </div>
        )}
      </div>

      {/* Endpoint drawer */}
      {drawer && (
        <EndpointDrawer
          serviceName={drawer.serviceName}
          endpoints={drawer.endpoints}
          onClose={() => setDrawer(null)}
        />
      )}

      {/* Edge popup */}
      {popup && (
        <EdgePopup
          connection={popup.connection}
          map={map}
          position={popup.position}
          onClose={() => setPopup(null)}
          onSeeMore={(endpoints, name) => {
            setDrawer({ serviceName: name, endpoints })
            setPopup(null)
          }}
        />
      )}
    </div>
  )
}

export function ConnectivityGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <FlowInner {...props} />
    </ReactFlowProvider>
  )
}
