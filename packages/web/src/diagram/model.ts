import type { ServiceConnection } from '@dependency-explorer/data'

export type EdgeMode = 'sync' | 'async' | 'data-feed'
export type NodeKind = 'service' | 'client' | 'monolith' | 'subject' | 'area' | 'summary' | 'unmapped' | 'unit' | 'job' | 'store'
export type GroupKind = 'group' | 'band' | 'lane'
export type Renderer = 'react-flow' | 'svg' | 'mermaid'
export type DiagramRef =
  | { type: 'service'; name: string }
  | { type: 'area'; id: string }
  | { type: 'resource'; id: string }
  | { type: 'connections'; keys: string[] }
  | { type: 'unit'; id: string }

export interface Box { x: number; y: number; w: number; h: number }
export interface RoutePoint { x: number; y: number }
export interface DiagramStore { label: string; resource?: string }
export interface DiagramNode extends Box {
  id: string
  kind: NodeKind
  label: string
  detail: string[]
  stores: DiagramStore[]
  fontSize: number
  ref?: DiagramRef
}
export interface DiagramGroup extends Box {
  id: string
  kind: GroupKind
  label: string
  members: string[]
  fontSize: number
  ref?: DiagramRef
}
export interface DiagramEdge {
  id: string
  from: string
  to: string
  mode: EdgeMode
  weight: number
  label: string
  directed: boolean
  condition?: string
  lane: number
  lanes: number
  ref?: DiagramRef
  route?: RoutePoint[]
  labelBox?: Box
}
export interface DiagramModel {
  id: string
  title: string
  width: number
  height: number
  nodes: DiagramNode[]
  groups: DiagramGroup[]
  edges: DiagramEdge[]
  renderers: Renderer[]
}

export const ALL_RENDERERS: Renderer[] = ['react-flow', 'svg', 'mermaid']

export function edgeMode(c: Pick<ServiceConnection, 'protocol' | 'communicationType'>): EdgeMode {
  return c.protocol === 'cdc' ? 'data-feed' : c.communicationType
}
