import type { DatadogOverlay } from '@dependency-explorer/data'

type ServiceHealth = DatadogOverlay['services'][string]

const STRIP_DAYS = 14

export const serviceHealth = (over: Partial<ServiceHealth> = {}): ServiceHealth => ({
  state: 'problem',
  reasons: ['5xx 4.1× (+63) over 72 h'],
  monitors: [
    { id: 1, name: 'svc-punch 5xx rate', status: 'Alert', noisy: false, url: 'https://app.datadoghq.eu/monitors/1' },
    { id: 2, name: 'svc-punch latency', status: 'OK', noisy: true, url: 'https://app.datadoghq.eu/monitors/2' },
  ],
  slos: [
    { id: 'a1', name: 'Punch availability', target: 99.9, value: 99.95, url: 'https://app.datadoghq.eu/slo?slo_id=a1' },
    { id: 'b2', name: 'Punch latency', target: 99, value: null, url: 'https://app.datadoghq.eu/slo?slo_id=b2' },
  ],
  strip: Array.from({ length: STRIP_DAYS }, (_, i) => ({
    day: `2026-10-${String(20 + i).padStart(2, '0')}`,
    requests: 1000 + i * 10,
    errors5xx: i === 3 ? null : i,
    p95ms: 200 + i,
  })),
  releases: [
    { sha: 'abcdef1234567', title: 'feat: punch rounding', mergedAt: '2026-10-28T10:00:00Z', verdict: 'regressed' },
    { sha: '1234567abcdef', title: 'fix: punch export', mergedAt: '2026-10-20T10:00:00Z', verdict: 'steady' },
    { sha: '9999999aaaaaa', title: 'chore: bump deps', mergedAt: '2026-11-01T10:00:00Z', verdict: 'tooRecent' },
  ],
  incidents: [{ id: 'IR-7', title: 'Punch exports fail', severity: 'SEV-2', url: 'https://app.datadoghq.eu/incidents/7' }],
  ...over,
})

export const overlayOf = (over: Partial<DatadogOverlay> = {}): DatadogOverlay => ({
  snapshotDate: '2026-11-02',
  eventsCapped: false,
  services: { 'svc-punch': serviceHealth() },
  queues: {},
  ...over,
})
