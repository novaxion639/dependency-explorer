import { useContext, useEffect, useMemo } from 'react'
import {
  Background, BackgroundVariant, BaseEdge, Controls, EdgeLabelRenderer, getViewportForBounds, Handle, Position, ReactFlow,
  useInternalNode, useNodesState, useReactFlow, useStore, type EdgeProps, type InternalNode, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Emphases } from '../focus'
import { edgeName } from '../edgeName'
import { edgeSegment, type Point } from '../geometry'
import type { Box, DiagramModel, DiagramRef } from '../model'
import { DASH, nodeFill, PAINT, strokeWidth } from '../paint'
import { enteredNodeId } from './nodeKey'
import { DiagramSelectContext } from './selectContext'
import { toReactFlow, type DiagramFlowEdge, type DiagramFlowNode, type DiagramGroupType, type DiagramNodeType } from './toReactFlow'
import styles from './ReactFlowDiagram.module.css'

function DiagramNodeView({ data }: NodeProps<DiagramNodeType>) {
  const select = useContext(DiagramSelectContext)
  const { node, emphasis } = data
  const paint = PAINT[emphasis]
  return (
    <div className={styles.node} data-kind={node.kind} style={{ background: nodeFill(node.kind, emphasis) ?? undefined, borderColor: paint.stroke, color: paint.text, opacity: paint.opacity, fontSize: node.fontSize }}>
      <Handle type="target" position={Position.Top} className={styles.handle} isConnectable={false} />
      {node.label && <strong>{node.label}</strong>}
      {node.detail.map((line, i) => <span key={`${i}:${line}`}>{line}</span>)}
      {node.stores.map(({ label, resource }) => (resource
        ? <button key={label} type="button" className={`${styles.store} nodrag`} onClick={e => { e.stopPropagation(); select({ type: 'resource', id: resource }) }}>{label}</button>
        : <span key={label}>{label}</span>))}
      <Handle type="source" position={Position.Bottom} className={styles.handle} isConnectable={false} />
    </div>
  )
}

function DiagramGroupView({ data }: NodeProps<DiagramGroupType>) {
  const { group, emphasis } = data
  const paint = PAINT[emphasis]
  return (
    <div className={styles.group} data-kind={group.kind} data-on={emphasis === 'on' ? 'true' : 'false'} style={{ borderColor: paint.stroke, opacity: paint.opacity, fontSize: group.fontSize }}>
      <Handle type="target" position={Position.Top} className={styles.handle} isConnectable={false} />
      <span className={styles.groupLabel} style={{ color: paint.text }}>{group.label}</span>
      <Handle type="source" position={Position.Bottom} className={styles.handle} isConnectable={false} />
    </div>
  )
}

function boxOf(n: InternalNode): Box {
  return { x: n.internals.positionAbsolute.x, y: n.internals.positionAbsolute.y, w: n.measured.width ?? n.width ?? 0, h: n.measured.height ?? n.height ?? 0 }
}

function nodeLabel(n: InternalNode<DiagramFlowNode>): string {
  const data = n.internals.userNode.data
  return 'group' in data ? data.group.label : data.node.label
}

function DiagramEdgeView({ id, source, target, markerEnd, data }: EdgeProps<DiagramFlowEdge>) {
  const select = useContext(DiagramSelectContext)
  const from = useInternalNode<DiagramFlowNode>(source)
  const to = useInternalNode<DiagramFlowNode>(target)
  if (!from || !to || !data) {
    return null
  }
  const { edge, emphasis } = data
  const s = edgeSegment(boxOf(from), boxOf(to), edge.lane, edge.lanes)
  const path = edge.route ? `M ${edge.route.map(p => `${p.x} ${p.y}`).join(' L ')}` : `M ${s.x1} ${s.y1} L ${s.x2} ${s.y2}`
  const at = edge.labelBox ? { x: edge.labelBox.x + edge.labelBox.w / 2, y: edge.labelBox.y + edge.labelBox.h / 2 } : { x: s.lx, y: s.ly }
  const paint = PAINT[emphasis]
  const ref = edge.ref
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke: paint.stroke, strokeWidth: strokeWidth(edge.weight), strokeDasharray: DASH[edge.mode], opacity: paint.opacity }} />
      {(edge.label || edge.condition) && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className={`${styles.edgeLabel} nodrag nopan`}
            data-wrapped={edge.labelLines ? 'true' : undefined}
            aria-label={edgeName(nodeLabel(from), nodeLabel(to), edge)}
            style={{ transform: `translate(-50%, -50%) translate(${at.x}px, ${at.y}px)`, opacity: paint.opacity, color: paint.text }}
            onClick={() => {
              if (ref) {
                select(ref)
              }
            }}
          >
            {edge.labelLines
              ? edge.labelLines.map((line, i) => <span key={`${i}:${line}`} className={styles.labelLine}>{line}</span>)
              : edge.label}
            {edge.condition && (
              <span className={styles.pill}>
                {edge.conditionLines
                  ? edge.conditionLines.map((line, i) => <span key={`${i}:${line}`} className={styles.labelLine}>{line}</span>)
                  : `if ${edge.condition}`}
              </span>
            )}
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

const FOCUS_MAX_ZOOM = 1
const STEP_MS = 300

function FitToFocus({ zoomTo }: { zoomTo: Box | null }) {
  const { fitView, setViewport } = useReactFlow()
  const width = useStore(s => s.width)
  const height = useStore(s => s.height)
  const minZoom = useStore(s => s.minZoom)
  useEffect(() => {
    if (!zoomTo) {
      void fitView({ duration: STEP_MS })
      return
    }
    if (width > 0 && height > 0) {
      const bounds = { x: zoomTo.x, y: zoomTo.y, width: zoomTo.w, height: zoomTo.h }
      void setViewport(getViewportForBounds(bounds, width, height, minZoom, FOCUS_MAX_ZOOM, 0), { duration: STEP_MS })
    }
  }, [zoomTo, width, height, minZoom, fitView, setViewport])
  return null
}

const nodeTypes = { diagramNode: DiagramNodeView, diagramGroup: DiagramGroupView }
const edgeTypes = { diagramEdge: DiagramEdgeView }

function refOf(n: DiagramFlowNode): DiagramRef | undefined {
  return 'group' in n.data ? n.data.group.ref : n.data.node.ref
}

interface Props {
  model: DiagramModel
  emphases: Emphases
  zoomTo: Box | null
  onSelect: (ref: DiagramRef) => void
  onMove: (id: string, position: Point) => void
}

export function ReactFlowDiagram({ model, emphases, zoomTo, onSelect, onMove }: Props) {
  const flow = useMemo(() => toReactFlow(model, emphases), [model, emphases])
  const [nodes, setNodes, onNodesChange] = useNodesState<DiagramFlowNode>(flow.nodes)
  useEffect(() => {
    setNodes(flow.nodes)
  }, [flow, setNodes])
  return (
    <DiagramSelectContext.Provider value={onSelect}>
      <ReactFlow
        nodes={nodes}
        edges={flow.edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_, n) => {
          const ref = refOf(n)
          if (ref) {
            onSelect(ref)
          }
        }}
        onKeyDown={e => {
          const id = enteredNodeId(e.key, e.target)
          const n = id ? nodes.find(x => x.id === id) : undefined
          const ref = n ? refOf(n) : undefined
          if (ref) {
            onSelect(ref)
          }
        }}
        onNodeDragStop={(_, n) => onMove(n.id, n.position)}
        fitView={zoomTo === null}
        minZoom={0.1}
        maxZoom={2}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--rule)" />
        <Controls showInteractive={false} />
        <FitToFocus zoomTo={zoomTo} />
      </ReactFlow>
    </DiagramSelectContext.Provider>
  )
}
