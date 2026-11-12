import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { NOW, microserviceRepo, monolithRepo, prodOnlyRepo } from './__fixtures__/repos'
import { isPromotion, lastRelease, waitingChanges, type Change } from './changes'
import { trunkOf, type Trunk } from './trunk'

let root = ''
let ms: ReturnType<typeof microserviceRepo>
let mono: ReturnType<typeof monolithRepo>
let msChanges: Change[] = []
let monoChanges: Change[] = []

const trunk = (dir: string): Trunk => trunkOf(dir) ?? { prod: 'master', staging: false }
const waits = (changes: Change[], sha: string) => changes.some((c) => c.sha === sha)

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'changes-'))
  ms = microserviceRepo(root)
  mono = monolithRepo(root)
  msChanges = waitingChanges(ms.dir, trunk(ms.dir), NOW)
  monoChanges = waitingChanges(mono.dir, trunk(mono.dir), NOW)
}, 30_000)

afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

describe('waitingChanges', () => {
  it('ignores a feature merged only into sandbox', () => {
    expect(waits(msChanges, ms.waitingOld)).toBe(false)
    expect(waits(msChanges, ms.waitingNew)).toBe(false)
  })

  it('counts a feature promoted to staging', () => {
    expect(waits(msChanges, ms.promoted)).toBe(true)
  })

  it('skips a shipped feature', () => {
    expect(waits(msChanges, ms.shipped)).toBe(false)
  })

  it('never counts the staging back-merge', () => {
    expect(waits(msChanges, ms.backMerge)).toBe(false)
    expect(waits(msChanges, ms.promotion)).toBe(false)
  })

  it('counts a hotfix merged into staging', () => {
    expect(waits(msChanges, ms.hotfix)).toBe(true)
  })

  it('counts each PR a team sandbox brings into staging', () => {
    expect(monoChanges.map((c) => c.sha)).toEqual([mono.mozzaTwo, mono.mozzaOne, mono.feature])
  })

  it('counts a change fast-forwarded from sandbox to staging once', () => {
    expect(msChanges.map((c) => c.sha)).toEqual([ms.promoted, ms.hotfix, ms.both])
  })

  it('reads the PR title from the merge body', () => {
    expect(msChanges.find((c) => c.sha === ms.hotfix)).toMatchObject({ title: 'fix: hotfix on staging', mergedAt: '2026-11-07T10:00:00Z' })
  })

  it('reads a repo with prod only', () => {
    const dir = prodOnlyRepo(root, 'svc-prod-only', 'master').dir
    expect(waitingChanges(dir, trunk(dir), NOW)).toEqual([])
  })
})

describe('lastRelease', () => {
  it('reads v1.31.0 from the last release', () => {
    expect(lastRelease(ms.dir, trunk(ms.dir))).toEqual({ sha: ms.release, title: 'chore(master): release v1.31.0', version: 'v1.31.0', mergedAt: '2026-10-15T10:00:00Z' })
  })

  it('falls back to the PR number without a release version', () => {
    expect(lastRelease(mono.dir, trunk(mono.dir))?.version).toBe('#11')
  })

  it('reads the release of a main repo', () => {
    expect(lastRelease(prodOnlyRepo(root, 'svc-release-main', 'main').dir, { prod: 'main', staging: false })?.version).toBe('v2.0.0')
  })

  it('is null without a merge on prod', () => {
    expect(lastRelease(prodOnlyRepo(root, 'svc-unreleased', 'master', false).dir, { prod: 'master', staging: false })).toBeNull()
  })
})

describe('isPromotion', () => {
  it('isPromotion matches trunk, prod and team sandbox merges, not a feature merge', () => {
    expect(isPromotion('Merge pull request #12 from skelloapp/sandbox')).toBe(true)
    expect(isPromotion("Merge branch 'staging' into sandbox")).toBe(true)
    expect(isPromotion("Merge remote-tracking branch 'origin/master' into staging")).toBe(true)
    expect(isPromotion('Merge pull request #13 from skelloapp/sandbox-mozza')).toBe(true)
    expect(isPromotion("Merge branch 'sandbox-mozza' into staging")).toBe(true)
    expect(isPromotion('Merge pull request #14 from skelloapp/feat-staging-export')).toBe(false)
  })
})
