import { describe, it, expect } from 'vitest'
import { ServiceFlowSchema } from '@dependency-explorer/schema'
import { flowRefIds } from './flow-chapters'

const flow = ServiceFlowSchema.parse({
  id: 'f', name: 'F', description: 'd', trigger: { actor: 'manager' }, primaryArea: 'planning', chapters: [{ title: 'Chapter', summary: 'Summary', refs: ['ctrl'] }],
  steps: [{ from: 'web', to: 'api', action: 'POST /things — create a thing' }, { from: 'api', to: 'audit', action: 'POST /events — audit' }],
  codeUnits: [
    { id: 'ctrl', service: 'api', kind: 'controller', label: 'ThingsController#create' },
    { id: 'job', service: 'api', kind: 'job', label: 'AuditJob' },
  ],
  infraNodes: [{ id: 'db', type: 'postgresql', label: 'things' }],
  codeEdges: [
    { from: 'web', to: 'ctrl', mode: 'sync' },
    { from: 'ctrl', to: 'db', mode: 'sync', crud: ['create'] },
    { from: 'ctrl', to: 'job', mode: 'async-job' },
    { from: 'job', to: 'audit', mode: 'sync' },
    { from: 'db', to: 'search', mode: 'async-event' },
  ],
})

describe('flow chapters', () => {
  it('collect every id a chapter may reference', () => {
    expect([...flowRefIds(flow)].sort()).toEqual(['api', 'audit', 'ctrl', 'db', 'job', 'search', 'web'])
  })
})
