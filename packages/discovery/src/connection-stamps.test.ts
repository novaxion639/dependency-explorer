import { describe, expect, it } from 'vitest'
import type { ServiceConnection } from '@dependency-explorer/schema'
import { stampKeyOf } from './connection-stamps'

const conn = (from: string, to: string, protocol: ServiceConnection['protocol']) => ({ from, to, protocol })

const connections = [
  conn('svc-hiring', 'skello-app', 'rest'),
  conn('svc-hiring', 'skello-app', 'cdc'),
  conn('svc-pos', 'skello-app', 'kinesis'),
  conn('skello-app', 'svc-shifts', 'sns'),
]

describe('stampKeyOf', () => {
  it('stamps the cdc channel of a pair mapped under rest and cdc with stream evidence', () => {
    expect(stampKeyOf(connections, 'svc-hiring', 'skello-app', 'cdc (stream consumer)')).toBe('svc-hiring→skello-app:cdc')
  })

  it('stamps the rest channel of the same pair with SDK evidence', () => {
    expect(stampKeyOf(connections, 'svc-hiring', 'skello-app', 'rest (SDK client, value import)')).toBe('svc-hiring→skello-app:rest')
  })

  it('stamps nothing when a two-protocol pair has evidence for neither', () => {
    expect(stampKeyOf(connections, 'svc-hiring', 'skello-app', 's3 (bucket notification)')).toBeNull()
  })

  it('reads cdc evidence as proof of a kinesis channel', () => {
    expect(stampKeyOf(connections, 'svc-pos', 'skello-app', 'cdc (DMS provision)')).toBe('svc-pos→skello-app:kinesis')
  })

  it('prefers the cdc channel over kinesis when a pair is mapped under both', () => {
    const both = [conn('svc-x', 'skello-app', 'kinesis'), conn('svc-x', 'skello-app', 'cdc')]
    expect(stampKeyOf(both, 'svc-x', 'skello-app', 'cdc (stream consumer)')).toBe('svc-x→skello-app:cdc')
  })

  it('stamps the only channel of a one-protocol pair whatever the transport says', () => {
    expect(stampKeyOf(connections, 'skello-app', 'svc-shifts', 'unknown')).toBe('skello-app→svc-shifts:sns')
  })

  it('returns null for a pair the map does not hold', () => {
    expect(stampKeyOf(connections, 'svc-a', 'svc-b', 'rest (HTTP)')).toBeNull()
  })
})
