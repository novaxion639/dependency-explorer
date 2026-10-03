import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type { Emphases, Emphasis } from '../focus'
import type { DiagramEdge, DiagramGroup, DiagramModel, DiagramNode } from '../model'

export type DiagramNodeType = Node<{ node: DiagramNode; emphasis: Emphasis }, 'diagramNode'>
export type DiagramGroupType = Node<{ group: DiagramGroup; emphasis: Emphasis }, 'diagramGroup'>
export type DiagramFlowNode = DiagramNodeType | DiagramGroupType
export type DiagramFlowEdge = Edge<{ edge: DiagramEdge; emphasis: Emphasis }, 'diagramEdge'>

export function toReactFlow(model: DiagramModel, emphases: Emphases): { nodes: DiagramFlowNode[]; edges: DiagramFlowEdge[] } {
  const groups = model.groups.map((group): DiagramGroupType => ({
    id: group.id,
    type: 'diagramGroup',
    position: { x: group.x, y: group.y },
    width: group.w,
    height: group.h,
    zIndex: -1,
    draggable: false,
    data: { group, emphasis: emphases.groups.get(group.id) ?? 'normal' },
  }))
  const nodes = model.nodes.map((node): DiagramNodeType => ({
    id: node.id,
    type: 'diagramNode',
    position: { x: node.x, y: node.y },
    width: node.w,
    height: node.h,
    data: { node, emphasis: emphases.nodes.get(node.id) ?? 'normal' },
  }))
  const edges = model.edges.map((edge): DiagramFlowEdge => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    type: 'diagramEdge',
    ...(edge.directed ? { markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, markerUnits: 'userSpaceOnUse', color: 'var(--ink)' } } : {}),
    data: { edge, emphasis: emphases.edges.get(edge.id) ?? 'normal' },
  }))
  return { nodes: [...groups, ...nodes], edges }
}
