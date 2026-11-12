import type { DeliveryOverlay } from '@dependency-explorer/data'

type DeliveryService = DeliveryOverlay['services'][string]

export const RELEASE_SHA = 'e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3'

export const deliveryService = (over: Partial<DeliveryService> = {}): DeliveryService => ({
  prod: 'master',
  fetchedAt: '2026-11-09T08:00:00.000Z',
  steps: [
    { branch: 'sandbox', count: 2, oldest: { sha: 'a1', title: 'feat: search by tag', mergedAt: '2026-11-06T10:00:00+01:00', workingDays: 2 } },
    { branch: 'staging', count: 1, oldest: { sha: 'b2', title: 'fix: index refresh', mergedAt: '2026-11-09T10:00:00+01:00', workingDays: 0 } },
  ],
  late: false,
  lastRelease: { sha: RELEASE_SHA, title: 'chore(master): release v1.31.0', version: 'v1.31.0', mergedAt: '2026-11-09T15:00:00+01:00' },
  ...over,
})

export const deliveryOverlayOf = (services: Record<string, DeliveryService>): DeliveryOverlay => ({
  generatedAt: '2026-11-10T09:00:00.000Z',
  services,
})
