import { useCallback, useEffect } from 'react'
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
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import type { ServiceFlow, ConnectivityMap, FlowInfraNode } from '@dependency-explorer/data'
import { buildFlowGraph } from '../../utils/buildFlowGraph'
import { ServiceNode } from '../nodes/ServiceNode'
import { DatabaseNode, DB_COLORS } from '../nodes/DatabaseNode'
import type { DatabaseType } from '@dependency-explorer/data'
import { ConnectivityEdge } from './ConnectivityEdge'
import { FloatingDbEdge } from './FloatingDbEdge'

const nodeTypes = { serviceNode: ServiceNode, databaseNode: DatabaseNode }
const edgeTypes = { connectivityEdge: ConnectivityEdge, floatingDbEdge: FloatingDbEdge }

interface Props {
  flow: ServiceFlow
  map: ConnectivityMap
  onBack: () => void
  onClose: () => void
}

function FlowInner({ flow, map, onBack, onClose }: Props) {
  const { fitView } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<ReturnType<typeof buildFlowGraph>['edges'][number]>([])

  useEffect(() => {
    const { nodes: n, edges: e } = buildFlowGraph(flow, map)
    setNodes(n)
    setEdges(e)
    setTimeout(() => fitView({ padding: 0.18, duration: 400 }), 60)
  }, [flow, map, setNodes, setEdges, fitView])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  return (
    <div
      onKeyDown={onKeyDown}
      tabIndex={-1}
      style={{ outline: 'none', display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {/* Toolbar */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid #2e3250',
        background: '#242736',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        flexShrink: 0,
      }}>
        {/* Top row: back + title + close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onBack}
            style={{
              background: 'none', border: '1px solid #2e3250', color: '#94a3b8',
              borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
            }}
          >
            ← Back
          </button>

          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', flex: 1 }}>
            {flow.name}
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#64748b',
              cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Description — full text, no truncation */}
        {flow.description && (
          <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
            {flow.description}
          </div>
        )}

        {/* Infra legend — deduplicated by label + type */}
        {(flow.infraNodes ?? []).length > 0 && (() => {
          const seen = new Map<string, { infra: FlowInfraNode; cruds: Set<string> }>()
          for (const infra of flow.infraNodes ?? []) {
            const key = `${infra.type}:${infra.label}`
            const existing = seen.get(key)
            if (existing) {
              for (const e of flow.infraEdges ?? []) {
                if (e.to === infra.id && e.crud?.length) e.crud.forEach(c => existing.cruds.add(c))
              }
            } else {
              const cruds = new Set<string>()
              for (const e of flow.infraEdges ?? []) {
                if (e.to === infra.id && e.crud?.length) e.crud.forEach(c => cruds.add(c))
              }
              seen.set(key, { infra, cruds })
            }
          }
          return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {[...seen.values()].map(({ infra, cruds }) => {
                const meta = DB_COLORS[infra.type as DatabaseType] ?? { color: '#64748b', icon: '💾', label: infra.type }
                const crudLabel = cruds.size ? [...cruds].map(c => c[0]!.toUpperCase()).join('') : ''
                return (
                  <span
                    key={infra.id}
                    title={infra.description}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      fontSize: 10, padding: '2px 6px', borderRadius: 4,
                      background: meta.color + '16', border: `1px solid ${meta.color}33`,
                      color: meta.color,
                    }}
                  >
                    <span>{meta.icon}</span>
                    <span style={{ fontWeight: 600 }}>{meta.label}</span>
                    {crudLabel && <span style={{ fontWeight: 700, fontSize: 9, opacity: 0.8 }}>[{crudLabel}]</span>}
                  </span>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* Flow graph */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.05}
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
              const type = (node.data as { type?: string }).type ?? ''
              if (type === 'vue-frontend')  return '#42b883'
              if (type === 'rails-monolith') return '#cc342d'
              return '#6366f1'
            }}
            maskColor="#0f111799"
          />
        </ReactFlow>

        {/* Step legend */}
        <StepLegend flow={flow} />
      </div>
    </div>
  )
}

function StepLegend({ flow }: { flow: ServiceFlow }) {
  return (
    <div style={{
      position: 'absolute',
      bottom: 10,
      left: 10,
      background: '#1a1d27cc',
      border: '1px solid #2e3250',
      borderRadius: 8,
      padding: '8px 12px',
      maxWidth: 280,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#3e4363', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Steps
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {flow.steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, color: '#6366f1',
              background: '#6366f122', border: '1px solid #6366f133',
              borderRadius: 3, padding: '0px 4px', flexShrink: 0,
            }}>
              {i + 1}
            </span>
            <span style={{ fontSize: 10, color: '#64748b' }}>
              <span style={{ color: '#818cf8' }}>{step.from}</span>
              {' → '}
              <span style={{ color: '#4f6ef7' }}>{step.to}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FlowGraphModal(props: Props) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={props.onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)',
        }}
      />

      {/* Modal container */}
      <div
        style={{
          position: 'fixed',
          top: '4vh', left: '4vw',
          width: '92vw', height: '92vh',
          zIndex: 201,
          background: '#13151f',
          border: '1px solid #2e3250',
          borderRadius: 14,
          boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        <ReactFlowProvider>
          <FlowInner {...props} />
        </ReactFlowProvider>
      </div>
    </>
  )
}
