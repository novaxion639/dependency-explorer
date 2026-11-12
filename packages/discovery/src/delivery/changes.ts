import { defaultGit, type GitRunner } from '../pinned'
import { firstParentMerges, PR_NUMBER } from '../datadog/releases'
import { versionOf } from '../datadog/health/rules'
import { sinceDaysBefore, type Trunk, type TrunkBranch } from './trunk'

export interface Change { sha: string; title: string; mergedAt: string; branch: TrunkBranch }
export interface Release { sha: string; title: string; version: string; mergedAt: string }

const CHANGE_WINDOW_DAYS = 90
const PROMOTION = [
  /^Merge pull request #\d+ from [^/\s]+\/(sandbox|staging|master|main)$/,
  /^Merge branch '(sandbox|staging|master|main)'/,
  /^Merge remote-tracking branch 'origin\/(sandbox|staging|master|main)'/,
]

export const isPromotion = (subject: string): boolean => PROMOTION.some((pattern) => pattern.test(subject))

export function waitingChanges(dir: string, trunk: Trunk, now: Date, git: GitRunner = defaultGit): Change[] {
  const since = sinceDaysBefore(now, CHANGE_WINDOW_DAYS)
  const notIn = (branches: string[]) => branches.map((branch) => `^origin/${branch}`)
  const hasStaging = trunk.branches.includes('staging')
  const sandboxOnly = new Set(
    trunk.branches.includes('sandbox')
      ? firstParentMerges(dir, [since, 'origin/sandbox', ...notIn([trunk.prod, ...(hasStaging ? ['staging'] : [])])], git).map((m) => m.sha)
      : [],
  )
  const candidates = trunk.branches.flatMap((branch) => firstParentMerges(dir, [since, `origin/${branch}`, ...notIn([trunk.prod])], git))
  return [...new Map(candidates.map((merge) => [merge.sha, merge])).values()]
    .filter((merge) => !isPromotion(merge.subject))
    .map(({ sha, title, mergedAt }) => ({ sha, title, mergedAt, branch: sandboxOnly.has(sha) ? 'sandbox' : 'staging' }))
}

export function lastRelease(dir: string, trunk: Trunk, git: GitRunner = defaultGit): Release | null {
  const [latest] = firstParentMerges(dir, ['-1', `origin/${trunk.prod}`], git)
  if (latest === undefined) {
    return null
  }
  const { sha, title, mergedAt, subject } = latest
  return { sha, title, version: versionOf(title, Number(PR_NUMBER.exec(subject)?.[1] ?? 0)), mergedAt }
}
