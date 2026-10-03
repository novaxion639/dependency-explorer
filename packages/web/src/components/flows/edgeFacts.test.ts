import { describe, it, expect } from 'vitest'
import type { FlowCodeEdge } from '@dependency-explorer/data'
import { edgeFacts } from './edgeFacts'

describe('edgeFacts', () => {
  it('spells out an edge: mode, transaction, CRUD, condition, flags, grade, auth, failure, PII, contracts', () => {
    const edge: FlowCodeEdge = {
      from: 'a', to: 'b', mode: 'async-job', inTransaction: true, crud: ['create', 'update'], condition: 'absence only',
      flags: [{ name: 'FEATUREDEV_X', kind: 'dev' }], auth: { gate: 'can_create_shifts!' }, failure: { dlq: 'jobs-dlq' },
      pii: ['email'], contractRefs: ['POST /events'],
    }
    expect(edgeFacts('f', edge, { 'f#a→b': 'graph' })).toEqual([
      'background job', 'in transaction', 'CRUD CU', 'if absence only', '🚩 FEATUREDEV_X', '✓ verified in the call graph',
      '🔑 can_create_shifts!', '🛡 DLQ jobs-dlq', '🧬 PII email', '📜 POST /events',
    ])
  })
  it('names weak evidence and a missing DLQ', () => {
    expect(edgeFacts('f', { from: 'a', to: 'b', failure: { dlqAbsent: 'confirmed-missing' } }, { 'f#a→b': 'text' })).toEqual(['sync', '~ name match only', '⚠ no DLQ'])
  })
})
