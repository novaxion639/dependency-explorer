import * as fs from 'node:fs'
import * as path from 'node:path'
import { execFileSync } from 'node:child_process'

export const NOW = new Date('2026-11-12T10:00:00Z')

const DAY_MS = 86_400_000
const daysAgo = (days: number): string => new Date(NOW.getTime() - days * DAY_MS).toISOString()

function history(dir: string, firstBranch: string) {
  const run = (args: string[], at = daysAgo(300)): string =>
    execFileSync('git', args, { cwd: dir, encoding: 'utf-8', env: { ...process.env, GIT_AUTHOR_DATE: at, GIT_COMMITTER_DATE: at } }).trim()
  fs.mkdirSync(dir, { recursive: true })
  run(['init', '-q', '-b', firstBranch])
  run(['config', 'user.email', 't@t'])
  run(['config', 'user.name', 't'])
  run(['config', 'commit.gpgsign', 'false'])
  fs.writeFileSync(path.join(dir, 'init.txt'), 'init')
  run(['add', '.'])
  run(['commit', '-q', '-m', 'init'])

  const merge = (into: string, from: string, subject: string, body: string, ago: number): string => {
    run(['checkout', '-q', into])
    run(['merge', '-q', '--no-ff', from, '-m', subject, ...(body ? ['-m', body] : [])], daysAgo(ago))
    return run(['rev-parse', 'HEAD'])
  }
  return {
    branch: (name: string, from: string): void => {
      run(['branch', name, from])
    },
    feature: (into: string, name: string, n: number, title: string, ago: number): string => {
      run(['checkout', '-q', '-b', name, into])
      fs.writeFileSync(path.join(dir, `${name}.txt`), name)
      run(['add', '.'])
      run(['commit', '-q', '-m', title], daysAgo(ago + 0.1))
      return merge(into, name, `Merge pull request #${n} from skelloapp/${name}`, title, ago)
    },
    promote: (from: string, into: string, n: number, title: string, ago: number): string =>
      merge(into, from, `Merge pull request #${n} from skelloapp/${from}`, title, ago),
    backMerge: (from: string, into: string, subject: string, ago: number): string => merge(into, from, subject, '', ago),
    fastForward: (into: string, from: string): void => {
      run(['checkout', '-q', into])
      run(['merge', '-q', '--ff-only', from])
    },
    clone: (root: string, name: string): string => {
      const target = path.join(root, name)
      execFileSync('git', ['clone', '-q', dir, target])
      return target
    },
  }
}

export function microserviceRepo(root: string) {
  const h = history(path.join(root, 'origins', 'svc-ms'), 'master')
  h.branch('staging', 'master')
  h.branch('sandbox', 'master')
  const shipped = h.feature('sandbox', 'feat-a', 1, 'feat: shipped search', 30)
  h.promote('sandbox', 'staging', 2, 'Sandbox to staging', 29)
  const release = h.promote('staging', 'master', 3, 'chore(master): release v1.31.0', 28)
  const backMerge = h.backMerge('staging', 'sandbox', "Merge branch 'staging' into sandbox", 27)
  const both = h.feature('sandbox', 'feat-b', 4, 'feat: promoted by fast-forward', 10)
  h.fastForward('staging', 'sandbox')
  const hotfix = h.feature('staging', 'hotfix-x', 5, 'fix: hotfix on staging', 5)
  const promoted = h.feature('sandbox', 'feat-c', 6, 'feat: promoted by merge', 4)
  const promotion = h.promote('sandbox', 'staging', 7, 'Sandbox to staging', 3)
  const waitingOld = h.feature('sandbox', 'feat-d', 8, 'feat: waiting on sandbox', 2)
  const waitingNew = h.feature('sandbox', 'feat-e', 9, 'feat: newest on sandbox', 1)
  return { dir: h.clone(root, 'svc-ms'), shipped, release, backMerge, both, hotfix, promoted, promotion, waitingOld, waitingNew }
}

export function monolithRepo(root: string) {
  const h = history(path.join(root, 'origins', 'skello-app'), 'master')
  h.branch('staging', 'master')
  h.branch('sandbox', 'master')
  h.feature('staging', 'feat-x', 10, 'feat: shipped planning', 40)
  const release = h.promote('staging', 'master', 11, 'Release planning', 39)
  h.backMerge('staging', 'sandbox', "Merge remote-tracking branch 'origin/staging' into sandbox", 38)
  const feature = h.feature('staging', 'feat-y', 12, 'feat: planning export', 6)
  h.branch('sandbox-mozza', 'staging')
  h.feature('sandbox-mozza', 'mozza-1', 13, 'feat: mozza one', 4)
  h.feature('sandbox-mozza', 'mozza-2', 14, 'feat: mozza two', 3)
  const mozza = h.promote('sandbox-mozza', 'staging', 15, 'Mozza batch', 2)
  h.backMerge('staging', 'sandbox', "Merge remote-tracking branch 'origin/staging' into sandbox", 1)
  return { dir: h.clone(root, 'skello-app'), release, feature, mozza }
}

export function pausedRepo(root: string, name: string, promotedDaysAgo: number) {
  const h = history(path.join(root, 'origins', name), 'master')
  h.branch('sandbox', 'master')
  h.feature('sandbox', 'feat-old', 1, 'feat: old', promotedDaysAgo + 1)
  h.promote('sandbox', 'master', 2, 'Sandbox to prod', promotedDaysAgo)
  const waiting = h.feature('sandbox', 'feat-new', 3, 'feat: waiting', 5)
  return { dir: h.clone(root, name), waiting }
}

export function prodOnlyRepo(root: string, name: string, prod: 'master' | 'main', released = true) {
  const h = history(path.join(root, 'origins', name), prod)
  if (released) {
    h.feature(prod, 'feat-z', 1, `chore(${prod}): release v2.0.0`, 3)
  }
  return { dir: h.clone(root, name) }
}
