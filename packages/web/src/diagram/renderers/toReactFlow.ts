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
  const laneOf = new Map(model.groups.filter(g => g.kind === 'lane').flatMap(g => g.members.map(m => [m, g] as const)))
  const nodes = model.nodes.map((node): DiagramNodeType => {
    const lane = laneOf.get(node.id)
    return {
      id: node.id,
      type: 'diagramNode',
      position: lane ? { x: node.x - lane.x, y: node.y - lane.y } : { x: node.x, y: node.y },
      width: node.w,
      height: node.h,
      draggable: false,
      ...(lane ? { parentId: lane.id, extent: 'parent' as const } : {}),
      data: { node, emphasis: emphases.nodes.get(node.id) ?? 'normal' },
    }
  })
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
