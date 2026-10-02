import { describe, it, expect } from 'vitest'
import { connectivityMap } from '@dependency-explorer/data'
import { buildFlowCodeGraph } from './buildFlowCodeGraph'

describe('buildFlowCodeGraph', () => {
  it('carries each unit edge grade on the edge data', () => {
    const flow = connectivityMap.flows.find(f => f.id === 'shift-creation')
    const edge = flow?.codeEdges?.find(e => flow.codeUnits?.some(u => u.id === e.to))
    if (!flow || !edge) {
      throw new Error('shift-creation has no unit edge')
    }
    const { edges } = buildFlowCodeGraph(flow, connectivityMap, { [`shift-creation#${edge.from}→${edge.to}`]: 'graph' })
    expect(edges.find(e => e.source === edge.from && e.target === edge.to)?.data?.grade).toBe('graph')
  })
})

describe('buildFlowCodeGraph resources', () => {
  it('carries the infra node resource on the node data', () => {
    const flow = connectivityMap.flows.find(f => f.id === 'shift-creation')
    const infra = flow?.infraNodes?.find(n => n.resources?.length)
    if (!flow || !infra) {
      throw new Error('shift-creation has no linked infra node')
    }
    expect(buildFlowCodeGraph(flow, connectivityMap).nodes.find(n => n.id === infra.id)?.data.resources).toEqual(infra.resources)
  })
})
