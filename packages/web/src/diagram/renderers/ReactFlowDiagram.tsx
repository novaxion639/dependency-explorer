import { useContext, useEffect, useMemo, useRef } from 'react'
import {
  Background, BackgroundVariant, BaseEdge, Controls, EdgeLabelRenderer, getViewportForBounds, Handle, Position, ReactFlow,
  useInternalNode, useNodesState, useReactFlow, useStore, type EdgeProps, type InternalNode, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Emphases } from '../focus'
import { edgeName } from '../edgeName'
import { edgeSegment, type Point, type Segment } from '../geometry'
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

function straight(s: Segment): Point[] {
  return [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }]
}

function labelPoint(s: Segment): Point {
  return { x: s.lx, y: s.ly }
}

function DiagramEdgeView({ id, source, target, markerEnd, data }: EdgeProps<DiagramFlowEdge>) {
  const select = useContext(DiagramSelectContext)
  const from = useInternalNode<DiagramFlowNode>(source)
  const to = useInternalNode<DiagramFlowNode>(target)
  if (!from || !to || !data) {
    return null
  }
  const { edge, emphasis } = data
  const segment = () => edgeSegment(boxOf(from), boxOf(to), edge.lane, edge.lanes)
  const path = `M ${(edge.route ?? straight(segment())).map(p => `${p.x} ${p.y}`).join(' L ')}`
  const at = edge.labelBox ? { x: edge.labelBox.x + edge.labelBox.w / 2, y: edge.labelBox.y + edge.labelBox.h / 2 } : labelPoint(segment())
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
const OVERVIEW_PADDING = 0.1

function FitToFrame({ frame, focused }: { frame: Box; focused: boolean }) {
  const { setViewport } = useReactFlow()
  const width = useStore(s => s.width)
  const height = useStore(s => s.height)
  const minZoom = useStore(s => s.minZoom)
  const maxZoom = useStore(s => s.maxZoom)
  const fitted = useRef(false)
  useEffect(() => {
    if (width === 0 || height === 0) {
      return
    }
    const bounds = { x: frame.x, y: frame.y, width: frame.w, height: frame.h }
    const viewport = getViewportForBounds(bounds, width, height, minZoom, focused ? FOCUS_MAX_ZOOM : maxZoom, focused ? 0 : OVERVIEW_PADDING)
    void setViewport(viewport, { duration: fitted.current ? STEP_MS : 0 }).then(() => {
      fitted.current = true
    })
  }, [frame, focused, width, height, minZoom, maxZoom, setViewport])
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
  frame: Box
  focused: boolean
  onSelect: (ref: DiagramRef) => void
  onMove: (id: string, position: Point) => void
}

export function ReactFlowDiagram({ model, emphases, frame, focused, onSelect, onMove }: Props) {
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
        minZoom={0.1}
        maxZoom={2}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--rule)" />
        <Controls showInteractive={false} />
        <FitToFrame frame={frame} focused={focused} />
      </ReactFlow>
    </DiagramSelectContext.Provider>
  )
}
