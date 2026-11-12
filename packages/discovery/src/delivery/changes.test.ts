import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { NOW, microserviceRepo, monolithRepo, pausedRepo, prodOnlyRepo } from './__fixtures__/repos'
import { isPromotion, lastRelease, waitingChanges, type Change } from './changes'
import { trunkOf, type Trunk } from './trunk'

let root = ''
let ms: ReturnType<typeof microserviceRepo>
let mono: ReturnType<typeof monolithRepo>
let msChanges: Change[] = []
let monoChanges: Change[] = []

const trunk = (dir: string): Trunk => trunkOf(dir, NOW) ?? { prod: 'master', branches: [] }
const branchOf = (changes: Change[], sha: string) => changes.find((c) => c.sha === sha)?.branch

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'changes-'))
  ms = microserviceRepo(root)
  mono = monolithRepo(root)
  msChanges = waitingChanges(ms.dir, trunk(ms.dir), NOW)
  monoChanges = waitingChanges(mono.dir, trunk(mono.dir), NOW)
})

afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

describe('waitingChanges', () => {
  it('places an unpromoted feature on sandbox', () => {
    expect(branchOf(msChanges, ms.waitingOld)).toBe('sandbox')
    expect(branchOf(msChanges, ms.waitingNew)).toBe('sandbox')
  })

  it('places a promoted feature on staging', () => {
    expect(branchOf(msChanges, ms.promoted)).toBe('staging')
  })

  it('skips a shipped feature', () => {
    expect(branchOf(msChanges, ms.shipped)).toBeUndefined()
  })

  it('never counts the staging back-merge', () => {
    expect(branchOf(msChanges, ms.backMerge)).toBeUndefined()
    expect(branchOf(msChanges, ms.promotion)).toBeUndefined()
  })

  it('counts a hotfix merged into staging', () => {
    expect(branchOf(msChanges, ms.hotfix)).toBe('staging')
  })

  it('counts a sandbox-mozza merge as one change on staging', () => {
    expect(monoChanges.map((c) => [c.sha, c.branch])).toEqual([[mono.mozza, 'staging'], [mono.feature, 'staging']])
  })

  it('counts a change on both trunks once, on staging', () => {
    expect(msChanges.filter((c) => c.sha === ms.both).map((c) => c.branch)).toEqual(['staging'])
    expect(msChanges).toHaveLength(5)
  })

  it('reads the PR title from the merge body', () => {
    expect(msChanges.find((c) => c.sha === ms.hotfix)).toMatchObject({ title: 'fix: hotfix on staging', mergedAt: '2026-11-07T10:00:00Z' })
  })

  it('shows the sandbox change of a repo whose last promotion is 120 days old', () => {
    const paused = pausedRepo(root, 'svc-paused', 120)
    expect(waitingChanges(paused.dir, trunk(paused.dir), NOW)).toEqual([{ sha: paused.waiting, title: 'feat: waiting', mergedAt: '2026-11-07T10:00:00Z', branch: 'sandbox' }])
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
    expect(lastRelease(prodOnlyRepo(root, 'svc-release-main', 'main').dir, { prod: 'main', branches: [] })?.version).toBe('v2.0.0')
  })

  it('is null without a merge on prod', () => {
    expect(lastRelease(prodOnlyRepo(root, 'svc-unreleased', 'master', false).dir, { prod: 'master', branches: [] })).toBeNull()
  })
})

describe('isPromotion', () => {
  it('isPromotion matches the three promotion subjects and not a feature merge', () => {
    expect(isPromotion('Merge pull request #12 from skelloapp/sandbox')).toBe(true)
    expect(isPromotion("Merge branch 'staging' into sandbox")).toBe(true)
    expect(isPromotion("Merge remote-tracking branch 'origin/master' into staging")).toBe(true)
    expect(isPromotion('Merge pull request #13 from skelloapp/sandbox-mozza')).toBe(false)
    expect(isPromotion('Merge pull request #14 from skelloapp/feat-staging-export')).toBe(false)
  })
})
