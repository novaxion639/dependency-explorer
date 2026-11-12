import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { DeliveryOverlaySchema } from '@dependency-explorer/schema'
import { defaultGit, type GitRunner } from '../pinned'
import { NOW, microserviceRepo, monolithRepo, prodOnlyRepo } from './__fixtures__/repos'
import { buildDeliveryOverlay, deliverySection, type DeliveryReport } from './overlay'

const DAY_MS = 86_400_000

let root = ''
let ms: ReturnType<typeof microserviceRepo>
let mono: ReturnType<typeof monolithRepo>
let report: DeliveryReport

const touchFetchHead = (dir: string, daysAgo: number) => {
  const file = path.join(dir, '.git', 'FETCH_HEAD')
  fs.writeFileSync(file, '')
  const at = new Date(NOW.getTime() - daysAgo * DAY_MS)
  fs.utimesSync(file, at, at)
  return at.toISOString()
}

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-overlay-'))
  ms = microserviceRepo(root)
  mono = monolithRepo(root)
  report = buildDeliveryOverlay([{ service: 'svc-ms', dir: ms.dir }, { service: 'skello-app', dir: mono.dir }], NOW, false)
}, 30_000)

afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

describe('buildDeliveryOverlay', () => {
  it('builds one entry per mapped repo', () => {
    expect(Object.keys(report.overlay.services)).toEqual(['svc-ms', 'skello-app'])
    expect(report.overlay.generatedAt).toBe(NOW.toISOString())
    expect(report.overlay.services['skello-app']).toMatchObject({
      prod: 'master',
      steps: [{ branch: 'staging', count: 2, oldest: { sha: mono.feature, title: 'feat: planning export', workingDays: 3 } }],
      lastRelease: { sha: mono.release, version: '#11' },
    })
  })

  it('orders steps sandbox then staging', () => {
    expect(report.overlay.services['svc-ms']?.steps).toEqual([
      { branch: 'sandbox', count: 2, oldest: { sha: ms.waitingOld, title: 'feat: waiting on sandbox', mergedAt: '2026-11-10T10:00:00Z', workingDays: 1 } },
      { branch: 'staging', count: 3, oldest: { sha: ms.both, title: 'feat: promoted by fast-forward', mergedAt: '2026-11-02T10:00:00Z', workingDays: 7 } },
    ])
  })

  it('marks late at 3 working days and not at 2', () => {
    const late = report.overlay.services['skello-app']
    const onTime = buildDeliveryOverlay([{ service: 'skello-app', dir: mono.dir }], new Date('2026-11-10T12:00:00Z'), false).overlay.services['skello-app']
    expect([late?.steps[0]?.oldest.workingDays, late?.late]).toEqual([3, true])
    expect([onTime?.steps[0]?.oldest.workingDays, onTime?.late]).toEqual([2, false])
  })

  it('records fetchedAt from FETCH_HEAD', () => {
    const fetchedAt = touchFetchHead(ms.dir, 1)
    expect(buildDeliveryOverlay([{ service: 'svc-ms', dir: ms.dir }], NOW, false).overlay.services['svc-ms']?.fetchedAt).toBe(fetchedAt)
    expect(report.overlay.services['skello-app']?.fetchedAt).toBeNull()
  })

  it('fetches the trunk branches only when asked', () => {
    const fetches: string[][] = []
    const recording: GitRunner = (cwd, args) => {
      if (args[0] === 'fetch') {
        fetches.push(args)
        return ''
      }
      return defaultGit(cwd, args)
    }
    buildDeliveryOverlay([{ service: 'svc-ms', dir: ms.dir }], NOW, false, recording)
    expect(fetches).toEqual([])
    buildDeliveryOverlay([{ service: 'svc-ms', dir: ms.dir }], NOW, true, recording)
    expect(fetches).toEqual([['fetch', '--quiet', 'origin', 'staging', 'sandbox']])
  })

  it('leaves out a repo without prod and keeps a repo with prod only', () => {
    const noProd = path.join(root, 'no-prod')
    fs.mkdirSync(noProd)
    defaultGit(noProd, ['init', '-q'])
    const prodOnly = prodOnlyRepo(root, 'svc-prod-only', 'main').dir
    const services = buildDeliveryOverlay([{ service: 'svc-no-prod', dir: noProd }, { service: 'svc-prod-only', dir: prodOnly }], NOW, false).overlay.services
    expect(Object.keys(services)).toEqual(['svc-prod-only'])
    expect(services['svc-prod-only']).toMatchObject({ prod: 'main', steps: [], late: false, lastRelease: { version: 'v2.0.0' } })
  })

  it('skips a repo whose git call fails and names it', () => {
    const failing: GitRunner = (cwd, args) => {
      if (args[0] === 'log' && cwd === ms.dir) {
        throw new Error('fatal: bad object refs/remotes/origin/staging')
      }
      return defaultGit(cwd, args)
    }
    const result = buildDeliveryOverlay([{ service: 'svc-ms', dir: ms.dir }, { service: 'skello-app', dir: mono.dir }], NOW, false, failing)
    expect(result.skipped).toEqual([{ repo: 'svc-ms', reason: 'fatal: bad object refs/remotes/origin/staging' }])
    expect(Object.keys(result.overlay.services)).toEqual(['skello-app'])
  })

  it('lists a clone fetched 4 days ago as stale', () => {
    const fetchedAt = touchFetchHead(mono.dir, 4)
    const result = buildDeliveryOverlay([{ service: 'svc-ms', dir: ms.dir }, { service: 'skello-app', dir: mono.dir }], NOW, false)
    expect(result.stale).toEqual([{ repo: 'skello-app', fetchedAt }])
  })

  it('the overlay passes DeliveryOverlaySchema', () => {
    expect(DeliveryOverlaySchema.parse(report.overlay)).toEqual(report.overlay)
  })
})

describe('deliverySection', () => {
  it('is null without a delivery run', () => {
    expect(deliverySection(null)).toBeNull()
  })

  it('lists late services oldest first, then skipped and stale repos', () => {
    const late = (workingDays: number) => ({
      prod: 'master' as const,
      fetchedAt: null,
      steps: [{ branch: 'sandbox' as const, count: 8, oldest: { sha: 'a', title: `change ${workingDays}`, mergedAt: '2026-11-02T10:00:00Z', workingDays } }],
      late: workingDays >= 3,
      lastRelease: null,
    })
    const section = deliverySection({
      overlay: { generatedAt: NOW.toISOString(), services: { 'svc-a': late(3), 'svc-b': late(5), 'svc-c': late(1) } },
      skipped: [{ repo: 'svc-d', reason: 'fatal: bad object' }],
      stale: [{ repo: 'svc-reports', fetchedAt: '2026-11-09T08:00:00.000Z' }],
    })
    expect(section).toBe([
      '\n## 🚚 Delivery (advisory, not in the baseline)\n',
      '- svc-b: 8 on sandbox, oldest 5 working days (change 5)',
      '- svc-a: 8 on sandbox, oldest 3 working days (change 3)',
      '- svc-d skipped: fatal: bad object',
      '- svc-reports fetched 2026-11-09: run with --pinned to refresh',
    ].join('\n'))
  })

  it('says none when nothing is late', () => {
    expect(deliverySection({ overlay: { generatedAt: NOW.toISOString(), services: {} }, skipped: [], stale: [] })).toBe('\n## 🚚 Delivery (advisory, not in the baseline)\n\n_none_')
  })
})
