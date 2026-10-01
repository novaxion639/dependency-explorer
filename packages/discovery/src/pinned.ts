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
  const stderr = e instanceof Error && 'stderr' in e && e.stderr ? String(e.stderr).trim() : ''
  const text = stderr || (e instanceof Error ? e.message : String(e))
  return text.split('\n')[0] ?? text
}

function removeWorktree(source: string, dir: string, git: GitRunner): void {
  if (!fs.existsSync(dir)) {
    return
  }
  try {
    git(source, ['worktree', 'remove', '--force', dir])
  } catch {
    fs.rmSync(dir, { recursive: true, force: true })
    git(source, ['worktree', 'prune'])
  }
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
      removeWorktree(source, dir, git)
    }
  }
  return { pinned, skipped }
}
export function buildGraphs(pinned: PinnedRepo[], run: (cwd: string) => void = cwd => {
  execFileSync('graphify', ['extract', '.', '--code-only'], { cwd, stdio: 'ignore' })
}): PinSkip[] {
  const skipped: PinSkip[] = []
  for (const p of pinned) {
    const file = path.join(p.dir, 'graphify-out', 'graph.json')
    const parsed: unknown = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : null
    const builtAt = typeof parsed === 'object' && parsed !== null && 'built_at_commit' in parsed ? String(parsed.built_at_commit) : ''
    if (builtAt === p.sha) {
      continue
    }
    try {
      run(p.dir)
    } catch (e) {
      skipped.push({ repo: p.repo, reason: `graphify: ${errorText(e)}` })
    }
  }
  return skipped
}

export function applyModeError(argv: string[]): string | null {
  if (argv.includes('--apply') && !argv.includes('--pinned')) {
    return '--apply requires --pinned: the overlay, grades and monolith routes are written from production branches only'
  }
  return null
}
