import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ConnectivityMapSchema, ResourceSurfaceSchema } from '@dependency-explorer/schema'
import { writeDatadogSnapshot } from './datadog/snapshot'
import { OUTPUT_FILES, PinError, runDiscovery, writeOutputs, type Dataset } from './discovery-run'

const NOW = new Date('2026-11-02T00:00:00Z')
const dataset: Dataset = {
  map: ConnectivityMapSchema.parse({ services: [], connections: [], flows: [] }),
  resources: ResourceSurfaceSchema.parse({ resources: [], relations: [] }),
  committedListeners: null,
}

let base = ''

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'discovery-run-'))
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  fs.rmSync(base, { recursive: true, force: true })
})

it('runs unpinned against an empty source base', () => {
  const report = runDiscovery({ sourceBase: base, dataset, now: NOW })

  expect(report.pinned).toBeNull()
  expect(report.scannedRepos).toEqual([])
})

it('throws a PinError when pinning finds no repo', () => {
  expect(() => runDiscovery({ sourceBase: base, dataset, pinnedBase: path.join(base, '.pinned'), fetchOrigin: false, now: NOW })).toThrow(PinError)
})

it('writes the overlay and the resource surface to the out dir', () => {
  const report = runDiscovery({ sourceBase: base, dataset, now: NOW })
  const outDir = path.join(base, 'generated')

  writeOutputs(report, { outDir, repoBase: base, now: NOW })

  expect(OUTPUT_FILES.filter(file => fs.existsSync(path.join(outDir, file)))).toEqual(['discovered.json', 'resources.json'])
  const overlay: unknown = JSON.parse(fs.readFileSync(path.join(outDir, 'discovered.json'), 'utf-8'))
  expect(overlay).toMatchObject({ generatedAt: '2026-11-02T00:00:00.000Z', scannedRepos: [] })
})

it('joins a Datadog snapshot and builds its overlay', () => {
  const dir = path.join(base, 'snapshot')
  const metrics = { api_count: null, api_5xx: null, api_4xx: null, api_p95: null, lambda_errors: null, fn_invocations: null, fn_errors: null, apm_hits: null, apm_p95: null, apm_status: null, dlq: null }
  writeDatadogSnapshot(dir, {
    meta: { fetchedAt: '2026-11-01T08:00:00.000Z', site: 'datadoghq.eu', from: 0, to: 1 },
    monitors: [], teams: [], slos: [], incidents: [], metrics, events: { items: [], capped: false },
  })

  const report = runDiscovery({ sourceBase: base, dataset, now: NOW, datadogSnapshotDir: dir })

  expect(report.datadog?.overlay).toEqual({ snapshotDate: '2026-11-01', eventsCapped: false, services: {}, queues: {} })
  expect(report.datadog?.join.findings).toEqual([])
})
