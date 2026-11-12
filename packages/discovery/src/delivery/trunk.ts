import { defaultGit, type GitRunner } from '../pinned'

export interface Trunk { prod: 'master' | 'main'; staging: boolean }

const DAY_MS = 86_400_000

const isMissingRef = (e: unknown): boolean => e instanceof Error && 'status' in e && e.status === 1

function hasOrigin(dir: string, branch: string, git: GitRunner): boolean {
  try {
    git(dir, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${branch}`])
    return true
  } catch (e) {
    if (isMissingRef(e)) {
      return false
    }
    throw e
  }
}

export const sinceDaysBefore = (now: Date, days: number): string => `--since=${new Date(now.getTime() - days * DAY_MS).toISOString()}`

export function trunkOf(dir: string, git: GitRunner = defaultGit): Trunk | null {
  const prod = (['master', 'main'] as const).find((branch) => hasOrigin(dir, branch, git))
  if (prod === undefined) {
    return null
  }
  return { prod, staging: hasOrigin(dir, 'staging', git) }
}

export function fetchTrunk(dir: string, git: GitRunner = defaultGit): void {
  if (hasOrigin(dir, 'staging', git)) {
    git(dir, ['fetch', '--quiet', 'origin', 'staging'])
  }
}
