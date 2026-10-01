import { describe, it, expect } from 'vitest'
import { ProductAreaSchema, ServiceFlowSchema, ExternalSystemSchema, ConnectivityMapSchema } from '@dependency-explorer/schema'
import { getFlowAreas, getAreaFlows, getAreaServices, getAreaExternals, getServiceLane, areasForFile, getCrossAreaEdges } from './areas-derive'

const planning = ProductAreaSchema.parse({
  id: 'planning', name: 'Planning', description: 'd', kind: 'product', color: '#6366f1',
  codeLocations: [
    { repo: 'skello-app', platform: 'monolith', globs: ['app/services/v3/shifts/**', 'app/models/shift.rb'] },
    { repo: 'svc-shifts', platform: 'backend', globs: ['**'] },
  ],
  readingPath: [], glossary: [],
})
const timeAttendance = ProductAreaSchema.parse({
  id: 'time-attendance', name: 'T&A', description: 'd', kind: 'product', color: '#f59e0b',
  codeLocations: [
    { repo: 'skello-app', platform: 'monolith', globs: ['app/models/shift.rb', 'app/models/badging.rb'] },
    { repo: 'svc-punch', platform: 'backend', globs: ['**'] },
  ],
  readingPath: [], glossary: [],
})
const search = ProductAreaSchema.parse({
  id: 'search', name: 'Search', description: 'd', kind: 'platform', color: '#475569',
  codeLocations: [{ repo: 'svc-shifts', platform: 'backend', globs: ['**'] }],
  readingPath: [], glossary: [],
})
const areas = [planning, timeAttendance, search]

const flow = ServiceFlowSchema.parse({
  id: 'shift-creation', name: 'Shift creation', description: 'd', steps: [],
  codeUnits: [
    { id: 'u1', service: 'skello-app', kind: 'service', label: 'CreateService', path: 'app/services/v3/shifts/create_service.rb' },
    { id: 'u2', service: 'skello-app', kind: 'model-callback', label: 'Shift callbacks' },
  ],
})

describe('area derivation', () => {
  it('derives flow areas from code-unit paths and skips units without a path', () => {
    expect(getFlowAreas(flow, areas).map(a => a.id)).toEqual(['planning'])
  })

  it('returns every area whose globs match a file, product and platform alike', () => {
    expect(areasForFile('skello-app', 'app/models/shift.rb', areas).map(a => a.id)).toEqual(['planning', 'time-attendance'])
    expect(areasForFile('svc-shifts', 'src/index.ts', areas).map(a => a.id)).toEqual(['planning', 'search'])
    expect(areasForFile('svc-users', 'src/index.ts', areas)).toEqual([])
  })

  it('lists the flows of an area', () => {
    expect(getAreaFlows(planning, [flow], areas).map(f => f.id)).toEqual(['shift-creation'])
    expect(getAreaFlows(timeAttendance, [flow], areas)).toEqual([])
  })

  it('lists the services of an area once each', () => {
    expect(getAreaServices(planning)).toEqual(['skello-app', 'svc-shifts'])
  })

  it('picks the first product area claiming the whole repo as the lane', () => {
    expect(getServiceLane('svc-shifts', areas)?.id).toBe('planning')
    expect(getServiceLane('skello-app', areas)).toBeUndefined()
  })

  it('lists externals used by an area service', () => {
    const yousign = ExternalSystemSchema.parse({
      id: 'yousign', name: 'Yousign', description: 'd', category: 'e-signature',
      usedBy: [{ service: 'svc-shifts', evidence: { kind: 'env', literal: 'YOUSIGN_API_KEY' } }],
    })
    expect(getAreaExternals(planning, [yousign]).map(e => e.id)).toEqual(['yousign'])
    expect(getAreaExternals(timeAttendance, [yousign])).toEqual([])
  })

  it('aggregates connections crossing into other areas', () => {
    const map = ConnectivityMapSchema.parse({
      services: [], flows: [], areas,
      connections: [
        { from: 'svc-shifts', to: 'svc-punch', sdkPackage: 'x', description: 'd', usedEndpoints: [], communicationType: 'sync', protocol: 'rest', authType: 'internal' },
        { from: 'svc-shifts', to: 'svc-punch', sdkPackage: 'x', description: 'd', usedEndpoints: [], communicationType: 'async', protocol: 'sqs', authType: 'iam-role' },
      ],
    })
    expect(getCrossAreaEdges(planning, map)).toEqual([
      { service: 'svc-shifts', otherArea: 'time-attendance', direction: 'out', count: 2 },
    ])
  })
})
