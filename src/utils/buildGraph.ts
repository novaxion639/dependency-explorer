import dagre from '@dagrejs/dagre'
import { MarkerType } from '@xyflow/react'
import type { Node, Edge } from '@xyflow/react'
import type { DependencyMap, Repo, SharedPackage, RepoType, PackageCategory } from '../types'

// Data shapes stored inside each node's .data field
export interface RepoNodeData {
  repo: Repo
  dimmed: boolean
  highlighted: boolean
  [key: string]: unknown
}

export interface PackageNodeData {
  pkg: SharedPackage
  dimmed: boolean
  highlighted: boolean
  [key: string]: unknown
}

const REPO_NODE_W = 180
const REPO_NODE_H = 52
const PKG_NODE_W = 210
const PKG_NODE_H = 52

export function buildGraph(
  data: DependencyMap,
  search: string,
  typeFilter: RepoType | '',
  catFilter: PackageCategory | '',
  selectedId: string | null,
): { nodes: Node[]; edges: Edge[] } {
  const searchLower = search.toLowerCase()

  const visibleRepos = new Set(
    data.repos
      .filter(r => !typeFilter || r.type === typeFilter)
      .map(r => r.name),
  )

  const visiblePackages = new Set(
    data.sharedPackages
      .filter(p => !catFilter || p.category === catFilter)
      .map(p => p.name),
  )

  // Build raw edges between visible nodes
  const rawEdges: Edge[] = []
  for (const repo of data.repos) {
    if (!visibleRepos.has(repo.name)) continue
    for (const dep of repo.internalDependencies) {
      if (!visiblePackages.has(dep)) continue
      rawEdges.push({
        id: `${repo.name}→${dep}`,
        source: repo.name,
        target: dep,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#3e4363', width: 12, height: 12 },
        style: { stroke: '#3e4363', strokeWidth: 1.5 },
      })
    }
  }

  // Only show package nodes that have edges (unless category filter is active)
  const connectedPkgIds = new Set(rawEdges.map(e => e.target))
  const finalPackageIds = new Set(
    [...visiblePackages].filter(id => connectedPkgIds.has(id) || !!catFilter),
  )

  const matchesSearch = (id: string) =>
    !searchLower || id.toLowerCase().includes(searchLower)

  // 1-hop neighbourhood for selected node
  let neighbourhood: Set<string> | null = null
  if (selectedId) {
    neighbourhood = new Set([selectedId])
    for (const e of rawEdges) {
      if (e.source === selectedId) neighbourhood.add(e.target)
      if (e.target === selectedId) neighbourhood.add(e.source)
    }
  }

  const isDimmed = (id: string): boolean => {
    if (neighbourhood) return !neighbourhood.has(id)
    if (searchLower) return !matchesSearch(id)
    return false
  }
  const isHighlighted = (id: string): boolean => {
    if (neighbourhood) return neighbourhood.has(id)
    if (searchLower) return matchesSearch(id)
    return false
  }

  // Build dagre layout graph
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 24, ranksep: 80, marginx: 40, marginy: 40 })

  const repoNodes: Node[] = []
  for (const repo of data.repos) {
    if (!visibleRepos.has(repo.name)) continue
    g.setNode(repo.name, { width: REPO_NODE_W, height: REPO_NODE_H })
    repoNodes.push({
      id: repo.name,
      type: 'repoNode',
      position: { x: 0, y: 0 },
      data: { repo, dimmed: isDimmed(repo.name), highlighted: isHighlighted(repo.name) },
    })
  }

  const pkgNodes: Node[] = []
  for (const pkg of data.sharedPackages) {
    if (!finalPackageIds.has(pkg.name)) continue
    g.setNode(pkg.name, { width: PKG_NODE_W, height: PKG_NODE_H })
    pkgNodes.push({
      id: pkg.name,
      type: 'packageNode',
      position: { x: 0, y: 0 },
      data: { pkg, dimmed: isDimmed(pkg.name), highlighted: isHighlighted(pkg.name) },
    })
  }

  const allNodeIds = new Set([...repoNodes.map(n => n.id), ...pkgNodes.map(n => n.id)])
  const finalEdges = rawEdges.filter(e => allNodeIds.has(e.source) && allNodeIds.has(e.target))
  for (const e of finalEdges) g.setEdge(e.source, e.target)

  dagre.layout(g)

  for (const node of repoNodes) {
    const pos = g.node(node.id)
    node.position = { x: pos.x - REPO_NODE_W / 2, y: pos.y - REPO_NODE_H / 2 }
  }
  for (const node of pkgNodes) {
    const pos = g.node(node.id)
    node.position = { x: pos.x - PKG_NODE_W / 2, y: pos.y - PKG_NODE_H / 2 }
  }

  const styledEdges: Edge[] = finalEdges.map(e => {
    const edgeDimmed = neighbourhood
      ? !neighbourhood.has(e.source) || !neighbourhood.has(e.target)
      : searchLower
        ? !matchesSearch(e.source) && !matchesSearch(e.target)
        : false
    const strokeColor = edgeDimmed ? '#1e2235' : '#3e4363'
    return {
      ...e,
      style: { stroke: strokeColor, strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor, width: 12, height: 12 },
    }
  })

  return { nodes: [...repoNodes, ...pkgNodes], edges: styledEdges }
}
