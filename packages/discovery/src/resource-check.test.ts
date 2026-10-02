import { describe, it, expect } from 'vitest'
import { checkResources } from './resource-check'
import type { Resource } from '@dependency-explorer/schema'

const r = (id: string, evidence = ['x:serverless']): Resource => ({ id, kind: 'queue', store: 'sqs', name: id, evidence })

describe('checkResources', () => {
  it('reports drift between the committed surface and the pinned extraction', () => {
    const out = checkResources([r('sqs:a'), r('sqs:gone')], [r('sqs:a'), r('sqs:new'), r('mongo:x', ['dataset:svc-x'])], [{ className: 'Ghost', file: 'app/models/ghost.rb', table: 'ghosts', associations: [] }], ['shifts'], true)
    expect(out.findings.map(f => `${f.kind}:${f.subject}`)).toEqual(['resource-gone:sqs:gone', 'resource-new:sqs:new', 'resource-new:mongo:x', 'model-without-table:Ghost'])
    expect(out.modelLess).toEqual(['shifts'])
    expect(out.datasetOnly).toBe(1)
  })
})

describe('checkResources readers', () => {
  it('reports missing monolith readers when no graph at the pinned commit was available', () => {
    const out = checkResources([], [], [], ['shifts'], false)
    expect(out.findings.map(f => `${f.kind}:${f.subject}`)).toEqual(['readers-unavailable:skello-app'])
  })
})
