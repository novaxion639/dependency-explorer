import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { buildGraph } from '../utils/buildGraph'
import { RepoNode } from './nodes/RepoNode'
import { PackageNode } from './nodes/PackageNode'
import type { DependencyMap, RepoType, PackageCategory } from '../types'
import type { Selection } from '../App'

const nodeTypes = {
  repoNode: RepoNode,
  packageNode: PackageNode,
}

interface Props {
  data: DependencyMap
  search: string
  typeFilter: RepoType | ''
  catFilter: PackageCategory | ''
  selection: Selection
  onSelect: (sel: Selection) => void
}

function FlowInner({ data, search, typeFilter, catFilter, selection, onSelect }: Props) {
  const { fitView } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const didFitOnce = useRef(false)

  const selectedId = useMemo(() => {
    if (!selection) return null
    return selection.kind === 'repo' ? selection.item.name : selection.item.name
  }, [selection])

  // Rebuild graph whenever filters or selection change
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = buildGraph(
      data, search, typeFilter, catFilter, selectedId,
    )
    setNodes(newNodes)
    setEdges(newEdges)

    // Fit view on first load; after that let user navigate freely
    if (!didFitOnce.current) {
      didFitOnce.current = true
      setTimeout(() => fitView({ padding: 0.08, duration: 400 }), 50)
    } else if (search || typeFilter || catFilter) {
      // Re-fit when filters narrow the graph
      setTimeout(() => fitView({ padding: 0.1, duration: 300 }), 50)
    }
  }, [data, search, typeFilter, catFilter, selectedId, setNodes, setEdges, fitView])

  const onNodeClick: NodeMouseHandler = useCallback((_evt, node) => {
    const repo = data.repos.find(r => r.name === node.id)
    if (repo) { onSelect({ kind: 'repo', item: repo }); return }
    const pkg = data.sharedPackages.find(p => p.name === node.id)
    if (pkg) onSelect({ kind: 'package', item: pkg })
  }, [data, onSelect])

  const onPaneClick = useCallback(() => onSelect(null), [onSelect])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      fitView
      minZoom={0.05}
      maxZoom={2}
      nodesDraggable
      nodesConnectable={false}
      elementsSelectable
      proOptions={{ hideAttribution: true }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1}
        color="#1e2235"
      />
      <Controls
        style={{ background: '#1a1d27', border: '1px solid #2e3250', borderRadius: 8 }}
      />
      <MiniMap
        style={{ background: '#0f1117', border: '1px solid #2e3250' }}
        nodeColor={node => {
          if (node.type === 'packageNode') return '#3e3070'
          return '#1e3a5f'
        }}
        maskColor="#0f111799"
      />
    </ReactFlow>
  )
}

export function GraphView(props: Props) {
  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <ReactFlowProvider>
        <FlowInner {...props} />
      </ReactFlowProvider>
    </div>
  )
}
