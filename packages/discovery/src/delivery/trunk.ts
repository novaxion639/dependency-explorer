import { defaultGit, type GitRunner } from '../pinned'

export type TrunkBranch = 'staging' | 'sandbox'
export interface Trunk { prod: 'master' | 'main'; branches: TrunkBranch[] }

const DAY_MS = 86_400_000
const SANDBOX_REACH_DAYS = 180
const TRUNK_BRANCHES = ['staging', 'sandbox'] as const

function hasOrigin(dir: string, branch: string, git: GitRunner): boolean {
  try {
    git(dir, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${branch}`])
    return true
  } catch {
    return false
  }
}

export const sinceDaysBefore = (now: Date, days: number): string => `--since=${new Date(now.getTime() - days * DAY_MS).toISOString()}`

function sandboxReachesProd(dir: string, prod: string, now: Date, git: GitRunner): boolean {
  const count = (exclude: string[]) =>
    Number(git(dir, ['rev-list', '--count', '--first-parent', '--merges', sinceDaysBefore(now, SANDBOX_REACH_DAYS), 'origin/sandbox', ...exclude]))
  return count([`^origin/${prod}`]) < count([])
}

export function trunkOf(dir: string, now: Date, git: GitRunner = defaultGit): Trunk | null {
  const prod = (['master', 'main'] as const).find((branch) => hasOrigin(dir, branch, git))
  if (prod === undefined) {
    return null
  }
  const branches = TRUNK_BRANCHES.filter((branch) => hasOrigin(dir, branch, git) && (branch === 'staging' || sandboxReachesProd(dir, prod, now, git)))
  return { prod, branches }
}

export function fetchTrunk(dir: string, git: GitRunner = defaultGit): void {
  const existing = TRUNK_BRANCHES.filter((branch) => hasOrigin(dir, branch, git))
  if (existing.length > 0) {
    git(dir, ['fetch', '--quiet', 'origin', ...existing])
  }
}
