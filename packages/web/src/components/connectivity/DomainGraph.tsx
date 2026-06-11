import { useCallback, useEffect, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { buildDomainGraph } from '../../utils/buildDomainGraph'
import { DomainNode } from '../nodes/DomainNode'
import { ExportPngButton } from '../ExportPngButton'
import type { ConnectivityMap } from '@dependency-explorer/data'

const nodeTypes = { domainNode: DomainNode }

interface Props {
  map: ConnectivityMap
  onSelectDomain: (domainId: string) => void
}

function DomainFlowInner({ map, onSelectDomain }: Props) {
  const { fitView } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const graphRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const { nodes: n, edges: e } = buildDomainGraph(map)
    setNodes(n)
    setEdges(e)
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50)
  }, [map, setNodes, setEdges, fitView])

  const onNodeClick: NodeMouseHandler = useCallback(
    (_evt, node) => {
      const domainId = node.id.replace('domain:', '')
      onSelectDomain(domainId)
    },
    [onSelectDomain],
  )

  return (
    <div ref={graphRef} style={{ flex: 1, position: 'relative' }}>
      <ExportPngButton target={graphRef} filename={() => 'dependency-map_domains'} />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        minZoom={0.3}
        maxZoom={2}
        nodesDraggable
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1e2235" />
        <Controls style={{ background: '#1a1d27', border: '1px solid #2e3250', borderRadius: 8 }} />
      </ReactFlow>

      {/* Hint */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12,
        background: '#1a1d27', border: '1px solid #2e3250', borderRadius: 6,
        padding: '6px 10px', fontSize: 10, color: '#64748b',
      }}>
        Click a domain to filter its services
      </div>
    </div>
  )
}

export function DomainGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <DomainFlowInner {...props} />
    </ReactFlowProvider>
  )
}
