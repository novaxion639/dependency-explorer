import * as fs from 'node:fs'
import * as path from 'node:path'
import { execFileSync } from 'node:child_process'

export type GitRunner = (cwd: string, args: string[]) => string

export const defaultGit: GitRunner = (cwd, args) =>
  execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

export interface PinnedRepo { repo: string; branch: string; sha: string; dir: string }
export interface PinSkip { repo: string; reason: string }

export function productionBranch(repo: string): 'master' | 'main' {
  return repo.endsWith('-tf') ? 'main' : 'master'
}

function errorText(e: unknown): string {
  const stderr = e instanceof Error && 'stderr' in e ? String(e.stderr).trim() : ''
  const text = stderr || (e instanceof Error ? e.message : String(e))
  return text.split('\n')[0] ?? text
}

export function pinRepos(repos: string[], sourceBase: string, pinnedBase: string, git: GitRunner = defaultGit): { pinned: PinnedRepo[]; skipped: PinSkip[] } {
  fs.mkdirSync(pinnedBase, { recursive: true })
  const pinned: PinnedRepo[] = []
  const skipped: PinSkip[] = []
  for (const repo of repos) {
    const source = path.join(sourceBase, repo)
    if (!fs.existsSync(path.join(source, '.git'))) {
      skipped.push({ repo, reason: 'not checked out' })
      continue
    }
    const branch = productionBranch(repo)
    const dir = path.join(pinnedBase, repo)
    try {
      git(source, ['fetch', '--quiet', 'origin', branch])
      const sha = git(source, ['rev-parse', 'FETCH_HEAD'])
      if (fs.existsSync(dir)) {
        git(dir, ['checkout', '--quiet', '--detach', sha])
      } else {
        git(source, ['worktree', 'add', '--quiet', '--detach', dir, sha])
      }
      pinned.push({ repo, branch, sha, dir })
    } catch (e) {
      skipped.push({ repo, reason: `origin/${branch}: ${errorText(e)}` })
    }
  }
  return { pinned, skipped }
}
