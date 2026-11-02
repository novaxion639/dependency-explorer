import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterAll, beforeAll, expect, test } from 'vitest'
import type { GitRunner } from '../pinned'
import { DAY, H, NOW, engineInput } from './health/__fixtures__/fake-metrics'
import { topicsOf } from './health/topics'
import { releasesOf } from './releases'

const SINCE = new Date((NOW - 14 * DAY) * 1000)
const iso = (t: number) => new Date(t * 1000).toISOString()

const envAt = (t: number) => ({
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Release Fixture',
  GIT_AUTHOR_EMAIL: 'release@example.test',
  GIT_AUTHOR_DATE: iso(t),
  GIT_COMMITTER_NAME: 'Release Fixture',
  GIT_COMMITTER_EMAIL: 'release@example.test',
  GIT_COMMITTER_DATE: iso(t),
})

const git: GitRunner = (cwd, args) => execFileSync('git', args, { cwd, env: envAt(NOW), encoding: 'utf-8' }).trim()

let dir = ''
const at = (t: number, args: string[]) => execFileSync('git', args, { cwd: dir, env: envAt(t), stdio: 'ignore' })

function merge(t: number, branch: string, message: string, into = 'master') {
  at(t, ['checkout', '-q', '-b', branch, into])
  at(t, ['commit', '-q', '--allow-empty', '-m', `work on ${branch}`])
  at(t, ['checkout', '-q', into])
  at(t, ['merge', '-q', '--no-ff', branch, '-m', message])
}

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'releases-'))
  at(NOW - 30 * DAY, ['init', '-q', '-b', 'master'])
  at(NOW - 30 * DAY, ['commit', '-q', '--allow-empty', '-m', 'initial'])
  merge(NOW - 20 * DAY, 'old', 'Merge pull request #7 from skello/old')
  merge(NOW - 3 * DAY, 'export', 'Merge pull request #12 from skello/export')
  at(NOW - 2 * DAY, ['commit', '-q', '--allow-empty', '-m', 'direct push'])
  at(NOW - 2 * DAY, ['checkout', '-q', '-b', 'staging'])
  merge(NOW - DAY, 'staged', 'Merge pull request #13 from skello/staged', 'staging')
  merge(NOW - 10 * H, 'hotfix', "Merge branch 'hotfix'")
})

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

test('reads merges on the production branch', () => {
  const rows = releasesOf(dir, 'svc-planning', 'master', SINCE, git)
  expect(rows.map((r) => [r.title, Date.parse(r.merged) / 1000])).toEqual([
    ["Merge branch 'hotfix'", NOW - 10 * H],
    ['Merge pull request #12 from skello/export', NOW - 3 * DAY],
  ])
  expect(rows.every((r) => r.repo === 'svc-planning' && /^[0-9a-f]{40}$/.test(r.sha) && r.changes.length === 0)).toBe(true)
})

test('parses the PR number', () => {
  expect(releasesOf(dir, 'svc-planning', 'master', SINCE, git).map((r) => r.number)).toEqual([0, 12])
})

test('skips merges older than 14 days', () => {
  const all = releasesOf(dir, 'svc-planning', 'master', new Date((NOW - 30 * DAY) * 1000), git)
  expect(all.map((r) => r.number)).toEqual([0, 12, 7])
  expect(releasesOf(dir, 'svc-planning', 'master', SINCE, git).map((r) => r.number)).not.toContain(7)
})

test('tooRecent under 72 h', () => {
  const releases = releasesOf(dir, 'svc-planning', 'master', SINCE, git)
  const judged = topicsOf(engineInput({ now: NOW, releases })).releases
  expect(judged.map((r) => [r.n, r.verdict])).toEqual([
    [12, 'steady'],
    [0, 'tooRecent'],
  ])
})
