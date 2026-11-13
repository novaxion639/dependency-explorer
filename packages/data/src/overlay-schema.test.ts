import { describe, it, expect } from 'vitest'
import { DatadogOverlaySchema, DeliveryOverlaySchema, JiraOverlaySchema, TeamSchema, type DatadogOverlay, type DeliveryOverlay, type JiraOverlay } from '@dependency-explorer/schema'

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

const jiraOverlay: JiraOverlay = {
  snapshotDate: '2026-11-02',
  host: 'skello.atlassian.net',
  areas: {
    planning: {
      open: 12,
      breached: 2,
      opened90d: 30,
      weekly: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
      featureAreas: [{ name: 'Shifts', open: 7, breached: 1, opened90d: 18 }],
      teams: [{ teamId: 'planning', open: 9 }, { teamId: null, open: 3 }],
      jql: 'project = BR AND cf[11070] in ("Shifts")',
    },
  },
  unmapped: { open: 4, breached: 0, jql: 'project = BR AND cf[11070] is EMPTY' },
  boards: { '42': { name: 'Planning board' } },
}

describe('JiraOverlaySchema', () => {
  it('parses a valid Jira overlay', () => {
    expect(JiraOverlaySchema.parse(jiraOverlay)).toEqual(jiraOverlay)
  })

  it('rejects a Jira overlay whose weekly has 12 weeks', () => {
    const short = { ...jiraOverlay, areas: { planning: { ...jiraOverlay.areas.planning, weekly: Array.from({ length: 12 }, () => 0) } } }
    expect(JiraOverlaySchema.safeParse(short).success).toBe(false)
  })
})

const deliveryOverlay: DeliveryOverlay = {
  generatedAt: '2026-11-12T09:00:00Z',
  services: {
    'svc-search': {
      prod: 'master',
      fetchedAt: '2026-11-12T08:59:00Z',
      steps: [{ branch: 'staging', count: 2, oldest: { sha: 'a1b2c3d', title: 'feat: search by tag', mergedAt: '2026-11-10T10:00:00+01:00', workingDays: 2 } }],
      late: false,
      lastRelease: { sha: 'e4f5a6b', title: 'chore(master): release v1.31.0', version: 'v1.31.0', mergedAt: '2026-11-09T15:00:00+01:00' },
    },
  },
}

describe('DeliveryOverlaySchema', () => {
  it('parses a valid delivery overlay', () => {
    expect(DeliveryOverlaySchema.parse(deliveryOverlay)).toEqual(deliveryOverlay)
  })

  it('rejects a step on sandbox', () => {
    const service = deliveryOverlay.services['svc-search']
    const sandbox = { ...deliveryOverlay, services: { 'svc-search': { ...service, steps: service.steps.map((step) => ({ ...step, branch: 'sandbox' })) } } }
    expect(DeliveryOverlaySchema.safeParse(sandbox).success).toBe(false)
  })

  it('rejects a merge date that is not an ISO instant', () => {
    const service = deliveryOverlay.services['svc-search']
    const blank = { ...deliveryOverlay, services: { 'svc-search': { ...service, steps: service.steps.map((step) => ({ ...step, oldest: { ...step.oldest, mergedAt: '' } })) } } }
    expect(DeliveryOverlaySchema.safeParse(blank).success).toBe(false)
  })

  it('rejects a fetch time that is not an ISO instant', () => {
    const service = deliveryOverlay.services['svc-search']
    expect(DeliveryOverlaySchema.safeParse({ ...deliveryOverlay, services: { 'svc-search': { ...service, fetchedAt: 'yesterday' } } }).success).toBe(false)
  })
})
