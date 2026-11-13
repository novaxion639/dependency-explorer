import { defaultGit, type GitRunner } from '../pinned'
import { mergesOf, PR_NUMBER } from '../datadog/releases'
import { versionOf } from '../datadog/health/rules'
import { sinceDaysBefore, type Trunk } from './trunk'

export interface Change { sha: string; title: string; mergedAt: string }
export interface Release { sha: string; title: string; version: string; mergedAt: string }

const CHANGE_WINDOW_DAYS = 90
const BRANCH = String.raw`(sandbox(-[\w.-]+)?|staging|master|main)`
const PROMOTION = [
  new RegExp(String.raw`^Merge pull request #\d+ from [^/\s]+\/${BRANCH}$`),
  new RegExp(`^Merge branch '${BRANCH}'`),
  new RegExp(`^Merge remote-tracking branch 'origin\\/${BRANCH}'`),
]

export const isPromotion = (subject: string): boolean => PROMOTION.some((pattern) => pattern.test(subject))

export function waitingChanges(dir: string, trunk: Trunk, now: Date, git: GitRunner = defaultGit): Change[] {
  if (!trunk.staging) {
    return []
  }
  return mergesOf(dir, [sinceDaysBefore(now, CHANGE_WINDOW_DAYS), 'origin/staging', `^origin/${trunk.prod}`], git)
    .filter((merge) => !isPromotion(merge.subject))
    .map(({ sha, title, mergedAt }) => ({ sha, title, mergedAt }))
}

export function lastRelease(dir: string, trunk: Trunk, git: GitRunner = defaultGit): Release | null {
  const [latest] = mergesOf(dir, ['--first-parent', '-1', `origin/${trunk.prod}`], git)
  if (latest === undefined) {
    return null
  }
  const { sha, title, mergedAt, subject } = latest
  return { sha, title, version: versionOf(title, Number(PR_NUMBER.exec(subject)?.[1] ?? 0)), mergedAt }
}

export function promotionsLookSquashed(dir: string, trunk: Trunk, now: Date, git: GitRunner = defaultGit): boolean {
  const since = sinceDaysBefore(now, CHANGE_WINDOW_DAYS)
  const merges = trunk.staging ? mergesOf(dir, ['--first-parent', since, 'origin/staging'], git) : []
  if (merges.length === 0) {
    return false
  }
  const unreached = Number(git(dir, ['rev-list', '--count', '--first-parent', '--merges', since, 'origin/staging', `^origin/${trunk.prod}`]))
  const oldest = Math.min(...merges.map((merge) => Date.parse(merge.mergedAt)))
  return unreached === merges.length && Date.parse(git(dir, ['log', '-1', '--format=%cI', `origin/${trunk.prod}`])) > oldest
}
