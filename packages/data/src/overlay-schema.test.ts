import { describe, it, expect } from 'vitest'
import { DatadogOverlaySchema, TeamSchema, type DatadogOverlay } from '@dependency-explorer/schema'

const service: DatadogOverlay['services'][string] = {
  state: 'problem',
  reasons: ['5xx 4.1× (+63) over 72 h'],
  monitors: [{ id: 1, name: 'Search 5xx', status: 'Alert', noisy: false, url: 'https://app.datadoghq.eu/monitors/1' }],
  slos: [{ id: 'abc', name: 'Search availability', target: 99.9, value: null, url: 'https://app.datadoghq.eu/slo?slo_id=abc' }],
  strip: [{ day: '2026-11-01', requests: 1200, errors5xx: null, p95ms: 310 }],
  releases: [{ sha: 'a1b2c3d', title: 'Merge pull request #12', mergedAt: '2026-10-31T10:00:00Z', verdict: 'tooRecent' }],
  incidents: [{ id: 'inc-1', title: 'Search degraded', severity: 'SEV-2', url: 'https://app.datadoghq.eu/incidents/1' }],
}

const overlay: DatadogOverlay = {
  snapshotDate: '2026-11-02',
  eventsCapped: false,
  services: { 'svc-search': service },
  queues: { 'sqs:fooDlq': { depthNow: 0, depthMax14d: 4 } },
}

describe('DatadogOverlaySchema', () => {
  it('parses a valid overlay', () => {
    expect(DatadogOverlaySchema.parse(overlay)).toEqual(overlay)
  })

  it('rejects an overlay with an unknown state', () => {
    const red = { ...overlay, services: { 'svc-search': { ...service, state: 'red' } } }
    expect(DatadogOverlaySchema.safeParse(red).success).toBe(false)
  })
})

describe('TeamSchema', () => {
  it('accepts Datadog team handles', () => {
    expect(TeamSchema.parse({ id: 'planning', name: 'Planning', datadogTeams: ['squad-planning'] }).datadogTeams).toEqual(['squad-planning'])
  })
})
