import { describe, it, expect } from 'vitest'
import { ConnectivityMapSchema } from '@dependency-explorer/schema'
import { flowRelations, resourceImpact, resourceIdForDatabase } from './resources-derive'
import { resourceSurface } from './index'

const map = ConnectivityMapSchema.parse({
  services: [{ name: 'svc-a', type: 'typescript-microservice', description: 'd', endpoints: [] }],
  connections: [],
  flows: [{
    id: 'f', name: 'F', description: 'd', steps: [],
    codeUnits: [{ id: 'm', service: 'svc-a', kind: 'manager', label: 'M', path: 'src/m.ts' }],
    infraNodes: [
      { id: 'pg', type: 'postgresql', label: 'shifts', resources: ['pg:skello_production.shifts'] },
      { id: 'q', type: 'sqs', label: 'jobs', resources: ['sqs:jobs'] },
    ],
    codeEdges: [
      { from: 'm', to: 'pg', crud: ['update'] },
      { from: 'm', to: 'q' },
      { from: 'q', to: 'svc-a' },
    ],
  }],
})

describe('flowRelations', () => {
  it('turns flow edges into flow-graded relations by direction and crud', () => {
    expect(flowRelations(map).map(r => `${r.relation} ${r.resource} ${r.service} ${r.file ?? '-'}`).sort()).toEqual([
      'consumes sqs:jobs svc-a -',
      'produces sqs:jobs svc-a src/m.ts',
      'writes pg:skello_production.shifts svc-a src/m.ts',
    ])
  })
})


describe('resourceImpact', () => {
  const resources = [
    { id: 'pg:skello_production.shifts', kind: 'table' as const, store: 'postgresql' as const, name: 'shifts', evidence: [] },
    { id: 'sqs:jobs', kind: 'queue' as const, store: 'sqs' as const, name: 'jobs', evidence: [] },
    { id: 'sqs:jobsDlq', kind: 'queue' as const, store: 'sqs' as const, name: 'jobsDlq', evidence: [] },
  ]
  const relations = [
    ...flowRelations(map),
    { resource: 'pg:skello_production.shifts', relation: 'writes' as const, service: 'svc-a', file: 'src/m.ts', grade: 'flow' as const },
    { resource: 'sqs:jobs', relation: 'dead-letters-to' as const, service: 'svc-a', target: 'sqs:jobsDlq', grade: 'config' as const },
  ]
  it('rolls relations up per service, dedupes, and lists flows with their crud', () => {
    const shifts = resourceImpact('pg:skello_production.shifts', map, resources, relations)
    expect(shifts?.counts).toEqual({ services: 1, files: 1, flows: 1 })
    expect(shifts?.byService[0]?.relations).toHaveLength(1)
    expect(shifts?.flows).toEqual([{ flowId: 'f', name: 'F', crud: ['update'] }])
  })
  it('exposes the dead-letter queue and returns null for unknown ids', () => {
    expect(resourceImpact('sqs:jobs', map, resources, relations)?.dlq).toBe('sqs:jobsDlq')
    expect(resourceImpact('sqs:nope', map, resources, relations)).toBeNull()
  })
})

describe('resourceIdForDatabase', () => {
  it('resolves a service database to its registry resource', () => {
    expect(resourceIdForDatabase('svc-requests', { type: 'postgresql', name: 'svc_requests' }, resourceSurface.resources)).toBe('pg:svc_requests')
    expect(resourceIdForDatabase('svc-requests', { type: 'sqs', name: 'not-a-queue' }, resourceSurface.resources)).toBeUndefined()
  })
})
