import { describe, it, expect } from 'vitest'
import { allResourceRelations, connectivityMap, ConnectivityMapSchema } from '@dependency-explorer/data'
import { computeImpact, impactMarks } from './impact'

const conn = (from: string, to: string, communicationType: 'sync' | 'async') => ({ from, to, sdkPackage: 'x', description: 'd', usedEndpoints: [], communicationType, protocol: communicationType === 'sync' ? 'rest' : 'sqs', authType: 'internal' })
const svc = (name: string) => ({ name, type: 'typescript-microservice', description: 'd', endpoints: [] })

const map = ConnectivityMapSchema.parse({
  services: ['front', 'api', 'worker', 'mailer', 'db-owner'].map(svc),
  connections: [conn('front', 'api', 'sync'), conn('api', 'worker', 'async'), conn('worker', 'mailer', 'async'), conn('api', 'db-owner', 'sync')],
  flows: [{ id: 'f', name: 'F', description: 'd', steps: [{ from: 'front', to: 'api', action: 'POST /x' }, { from: 'api', to: 'worker', action: 'enqueue' }] }],
})

describe('computeImpact', () => {
  it('lists only flows that call the origin directly — a hub failing transitively is not a flow break', () => {
    expect(computeImpact(map, [], 'api').flows).toEqual([{ flowId: 'f', name: 'F', step: 1, from: 'front', to: 'api' }])
    expect(computeImpact(map, [{ resource: 'sqs:jobs', relation: 'produces', service: 'api', grade: 'code' }], 'sqs:jobs').flows).toEqual([{ flowId: 'f', name: 'F', step: 1, from: 'front', to: 'api' }])
  })
  it('fails sync callers, degrades async producers and starves downstream consumers — never callees', () => {
    const r = computeImpact(map, [], 'worker')
    expect(r.entries.map(e => `${e.node}:${e.effect}:${e.hop}`).sort()).toEqual(['api:degrades:1', 'mailer:starves:1'])
    expect(r.entries.some(e => e.node === 'front')).toBe(false)
  })
  it('propagates failure up the sync chain and lists the flow step that breaks', () => {
    const r = computeImpact(map, [], 'db-owner')
    expect(r.entries.map(e => `${e.node}:${e.effect}:${e.hop}`).sort()).toEqual(['api:fails:1', 'front:fails:2', 'mailer:starves:3', 'worker:starves:2'])
    expect(r.flows).toEqual([])
  })
  it('impacts writers and consumers of a failing resource', () => {
    const r = computeImpact(map, [
      { resource: 'sqs:jobs', relation: 'produces', service: 'api', grade: 'code' },
      { resource: 'sqs:jobs', relation: 'consumes', service: 'worker', grade: 'config' },
    ], 'sqs:jobs')
    expect(r.entries.find(e => e.node === 'api')?.effect).toBe('fails')
    expect(r.entries.find(e => e.node === 'worker')?.effect).toBe('starves')
  })
})

describe('computeImpact effect ranking', () => {
  it('keeps the strongest effect when a node is both an async partner and a sync caller of the origin', () => {
    const both = ConnectivityMapSchema.parse({
      services: ['hub', 'pos'].map(svc),
      connections: [conn('hub', 'pos', 'async'), conn('pos', 'hub', 'sync')],
      flows: [],
    })
    expect(computeImpact(both, [], 'hub').entries.map(e => `${e.node}:${e.effect}:${e.mode}`)).toEqual(['pos:fails:sync'])
  })
  it('keeps fails over starves for a resource writer that also consumes it', () => {
    const r = computeImpact(map, [
      { resource: 'kinesis:bus', relation: 'consumes', service: 'api', grade: 'config' },
      { resource: 'kinesis:bus', relation: 'writes', service: 'api', grade: 'code' },
    ], 'kinesis:bus')
    expect(r.entries.find(e => e.node === 'api')?.effect).toBe('fails')
  })
})

describe('impactMarks', () => {
  it('marks the origin and every impacted service by effect, keyed by map node id', () => {
    const marks = impactMarks(computeImpact(connectivityMap, allResourceRelations, 'svc-requests'))
    expect(marks.get('svc:svc-requests')).toBe('origin')
    expect(marks.get('svc:skello-app')).toBe('fails')
  })
})
