import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ConnectivityMapSchema, ResourceSurfaceSchema } from '@dependency-explorer/schema'
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
