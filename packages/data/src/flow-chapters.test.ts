import { describe, it, expect } from 'vitest'
import { ServiceFlowSchema } from '@dependency-explorer/schema'
import { deriveChapters, flowChapters, flowRefIds } from './flow-chapters'

const flow = ServiceFlowSchema.parse({
  id: 'f', name: 'F', description: 'd',
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
  it('derive one chapter per step, then side effects and replication', () => {
    const chapters = deriveChapters(flow)
    expect(chapters.map(c => c.title)).toEqual(['Step 1', 'Step 2', 'Side effects', 'Replication'])
    expect(chapters[0]).toEqual({ title: 'Step 1', summary: 'POST /things — create a thing', refs: ['web', 'api'] })
    expect(chapters[2]?.refs).toEqual(['ctrl', 'job'])
    expect(chapters[3]?.refs).toEqual(['db', 'search'])
  })
  it('prefer authored chapters and say which ones it returns', () => {
    expect(flowChapters(flow).authored).toBe(false)
    const authored = { ...flow, chapters: [{ title: 'A thing is created', summary: 'The API writes it.', refs: ['ctrl'] }] }
    expect(flowChapters(authored)).toEqual({ chapters: authored.chapters, authored: true })
  })
})
