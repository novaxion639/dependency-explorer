import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { OUTPUT_FILES, runDiscovery, writeOutputs, type Report } from './discovery-run'
import { goldenDataset } from './__golden__/dataset'
import { buildGoldenWorkspace } from './__golden__/workspace'

const GOLDEN_DIR = join(import.meta.dirname, '__golden__')
const NOW = new Date('2026-11-02T00:00:00Z')

const NOT_COVERED: Partial<Record<keyof Report, string>> = {
  unverifiable: 'the dataset holds two connections, both from checked-out TypeScript repos declaring an @skelloapp SDK package',
  sdkUsage: 'needs a skello-libs-ts checkout for the SDK registry',
  sdkRegistryStats: 'needs a skello-libs-ts checkout for the SDK registry',
  piiFacts: 'needs a skello-libs-ts checkout with lib-anonymizer decorators',
  piiCheck: 'verifies edge PII refs against piiFacts, which needs skello-libs-ts',
  machineCheck: 'needs a Step Functions definition, its handlers and a src/container.ts wiring in a service repo',
  datadog: 'runs only with datadogSnapshotDir',
}

const isBlank = (value: unknown): boolean =>
  value === null || value === 0 || (typeof value === 'object' && Object.values(value).every(isBlank))

let root = ''

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(root, { recursive: true, force: true })
})

function copyFixtureGraph(cwd: string): void {
  const fixture = join(GOLDEN_DIR, 'graphs', `${basename(cwd)}.graph.json`)
  const graph = existsSync(fixture) ? JSON.parse(readFileSync(fixture, 'utf-8')) : { nodes: [], links: [] }
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf-8' }).trim()
  mkdirSync(join(cwd, 'graphify-out'), { recursive: true })
  writeFileSync(join(cwd, 'graphify-out', 'graph.json'), JSON.stringify({ ...graph, built_at_commit: sha }))
}

function expectGolden(actual: unknown, expectedFile: string): void {
  const text = [realpathSync(root), root].reduce((json, dir) => json.replaceAll(dir, '<root>'), JSON.stringify(actual, null, 2)) + '\n'
  const expectedPath = join(GOLDEN_DIR, expectedFile)
  if (process.env.GOLDEN_UPDATE === '1') {
    writeFileSync(expectedPath, text)
    return
  }
  expect(text, expectedFile).toBe(readFileSync(expectedPath, 'utf-8'))
}

it('reproduces the golden outputs', () => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  root = mkdtempSync(join(tmpdir(), 'golden-'))
  buildGoldenWorkspace(join(root, 'src'))
  const built: string[] = []

  const report = runDiscovery({
    sourceBase: join(root, 'src'), pinnedBase: join(root, 'pinned'), fetchOrigin: false,
    buildGraph: cwd => {
      built.push(cwd)
      copyFixtureGraph(cwd)
    },
    now: NOW, dataset: goldenDataset, awsSnapshotDir: join(GOLDEN_DIR, 'aws-snapshot'),
  })
  writeOutputs(report, { outDir: join(root, 'out'), repoBase: join(root, 'pinned'), now: NOW })

  expect(built).toEqual([join(root, 'pinned', 'skello-app'), join(root, 'pinned', 'svc-alpha')])
  expect(report.pinned?.skipped).toEqual([])
  for (const file of OUTPUT_FILES) {
    expectGolden(JSON.parse(readFileSync(join(root, 'out', file), 'utf-8')), `expected/${file}`)
  }
  expectGolden(report, 'expected/report.json')
  for (const [section, value] of Object.entries(report)) {
    expect(isBlank(value), section).toBe(section in NOT_COVERED)
  }
})
