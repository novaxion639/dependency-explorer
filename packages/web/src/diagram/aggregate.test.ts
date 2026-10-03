import { describe, it, expect } from 'vitest'
import type { CommunicationType, Protocol, ServiceConnection } from '@dependency-explorer/data'
import { aggregateEdges, edgeLabel } from './aggregate'
import { edgeMode } from './model'

function conn(from: string, to: string, protocol: Protocol, communicationType: CommunicationType = 'sync'): ServiceConnection {
  return { from, to, protocol, communicationType, sdkPackage: 'sdk', description: '', usedEndpoints: [], authType: 'jwt' }
}

const side = (s: string) => (s.startsWith('a') ? 'A' : 'B')

describe('edgeMode', () => {
  it('treats CDC as a data feed and keeps the declared mode otherwise', () => {
    expect(edgeMode(conn('a', 'b', 'cdc', 'async'))).toBe('data-feed')
    expect(edgeMode(conn('a', 'b', 'sns', 'async'))).toBe('async')
    expect(edgeMode(conn('a', 'b', 'mongodb'))).toBe('sync')
  })
})

describe('edgeLabel', () => {
  it('counts protocols, most frequent first', () => {
    expect(edgeLabel([conn('a1', 'b', 'rest'), conn('a2', 'b', 'rest'), conn('a1', 'c', 'cdc', 'async')])).toBe('REST ×2 · CDC')
  })
})

describe('aggregateEdges', () => {
  const conns = [
    conn('a1', 'b', 'rest'),
    conn('a2', 'b', 'rest'),
    conn('b', 'a1', 'sqs', 'async'),
    conn('a1', 'b', 'cdc', 'async'),
    conn('a1', 'a2', 'rest'),
  ]
  const edges = aggregateEdges(conns, c => [side(c.from), side(c.to)])

  it('draws one edge per group pair and mode, dropping edges inside a group', () => {
    expect(edges.map(e => e.id)).toEqual(['A>B:data-feed', 'A>B:sync', 'B>A:async'])
    expect(edges.find(e => e.id === 'A>B:sync')).toMatchObject({ weight: 2, label: 'REST ×2', directed: true })
  })
  it('gives every edge between the same two groups its own lane', () => {
    const canonical = edges.map(e => (e.from < e.to ? e.lane : e.lanes - 1 - e.lane)).sort()
    expect(canonical).toEqual([0, 1, 2])
    expect(edges.every(e => e.lanes === 3)).toBe(true)
  })
  it('points back to the connections it aggregates', () => {
    expect(edges.find(e => e.id === 'A>B:sync')?.ref).toEqual({ type: 'connections', keys: ['a1~b~rest', 'a2~b~rest'] })
  })
  it('skips connections without both ends', () => {
    expect(aggregateEdges(conns, c => (c.protocol === 'rest' ? null : [side(c.from), side(c.to)])).map(e => e.id)).toEqual(['A>B:data-feed', 'B>A:async'])
  })
})
