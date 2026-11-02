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
  candidates: 'every evidence lands on one of the two dataset connections; the queue-literal path needs an svc-prefixed queue name',
  asyncSenders: 'the sender scan only matches svc-prefixed queue names (svcAlphaJobs); the fixture queue is alphaJobs',
  unverifiable: 'every connection starts in a checked-out TypeScript repo with an @skelloapp SDK package',
  frontendServices: 'no skello-app-front repo in the fixture workspace',
  weakSdkEvidence: 'a type-only or declared-only import of svc-alpha in svc-beta would verify the stale connection',
  sdkUsage: 'needs a skello-libs-ts checkout for the SDK registry',
  sdkRegistryStats: 'needs a skello-libs-ts checkout for the SDK registry',
  piiFacts: 'needs a skello-libs-ts checkout with lib-anonymizer decorators',
  ignoredSdks: 'no package of IGNORED_SDKS in the fixtures',
  reposWithoutServiceDefinition: 'every scanned repo is a dataset service',
  railsUnmapped: 'no outbound Rails client in the fixture monolith',
  awsLive: 'the AWS snapshot comparison runs only with awsSnapshotDir',
}

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
  const text = [root, realpathSync(root)].reduce((json, dir) => json.replaceAll(dir, '<root>'), JSON.stringify(actual, null, 2)) + '\n'
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
    now: NOW, dataset: goldenDataset,
  })
  writeOutputs(report, { outDir: join(root, 'out'), repoBase: join(root, 'pinned'), now: NOW })

  expect(built).toEqual([join(root, 'pinned', 'skello-app'), join(root, 'pinned', 'svc-alpha')])
  expect(report.pinned?.skipped).toEqual([])
  for (const file of OUTPUT_FILES) {
    expectGolden(JSON.parse(readFileSync(join(root, 'out', file), 'utf-8')), `expected/${file}`)
  }
  expectGolden(report, 'expected/report.json')
  for (const section of Object.keys(NOT_COVERED)) {
    expect(JSON.stringify(Object.entries(report).find(([key]) => key === section)?.[1]), section).toMatch(/^(null|\[\]|\{\})$/)
  }
})
