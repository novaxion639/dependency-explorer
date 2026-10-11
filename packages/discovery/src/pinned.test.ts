import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { execFileSync } from 'node:child_process'
import { productionBranch, pinRepos, buildGraphs, defaultGit, applyModeError, emptyPinError } from './pinned'

let root = ''
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf-8' }).trim()

function originWith(name: string, branches: Record<string, string>): string {
  const dir = path.join(root, 'origins', name)
  fs.mkdirSync(dir, { recursive: true })
  git(dir, 'init', '-q', '-b', Object.keys(branches)[0] ?? 'master')
  git(dir, 'config', 'user.email', 't@t'); git(dir, 'config', 'user.name', 't')
  for (const [branch, content] of Object.entries(branches)) {
    git(dir, 'checkout', '-q', '-B', branch)
    fs.writeFileSync(path.join(dir, 'file.txt'), content)
    git(dir, 'add', '.'); git(dir, 'commit', '-q', '-m', branch)
  }
  return dir
}

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'pinned-'))
  const src = path.join(root, 'src')
  fs.mkdirSync(src)
  git(src, 'clone', '-q', originWith('svc-a', { master: 'prod', sandbox: 'wip' }), 'svc-a')
  git(path.join(src, 'svc-a'), 'checkout', '-q', 'sandbox')
  git(src, 'clone', '-q', '--single-branch', '--branch', 'sandbox', originWith('svc-b', { master: 'prod-b', sandbox: 'wip-b' }), 'svc-b')
  git(src, 'clone', '-q', originWith('svc-c-tf', { main: 'tf' }), 'svc-c-tf')
  git(src, 'clone', '-q', originWith('svc-d', { sandbox: 'only' }), 'svc-d')
})

afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

describe('productionBranch', () => {
  it('is main for terraform repos and master otherwise', () => {
    expect(productionBranch('svc-punch-tf')).toBe('main')
    expect(productionBranch('skello-app')).toBe('master')
  })
})

describe('pinRepos', () => {
  it('materialises the production branch whatever is checked out, including single-branch clones', () => {
    const { pinned, skipped } = pinRepos(['svc-a', 'svc-b', 'svc-c-tf', 'svc-d', 'svc-missing'], path.join(root, 'src'), path.join(root, 'pinned'))
    const byRepo = new Map(pinned.map(p => [p.repo, p]))
    expect(fs.readFileSync(path.join(root, 'pinned', 'svc-a', 'file.txt'), 'utf-8')).toBe('prod')
    expect(fs.readFileSync(path.join(root, 'pinned', 'svc-b', 'file.txt'), 'utf-8')).toBe('prod-b')
    expect(byRepo.get('svc-c-tf')?.branch).toBe('main')
    expect(byRepo.get('svc-a')?.sha).toMatch(/^[0-9a-f]{40}$/)
    expect(skipped.map(s => s.repo).sort()).toEqual(['svc-d', 'svc-missing'])
    expect(skipped.find(s => s.repo === 'svc-d')?.reason).toMatch(/origin\/master: .*couldn't find remote ref master/)
    expect(fs.readFileSync(path.join(root, 'src', 'svc-a', 'file.txt'), 'utf-8')).toBe('wip')
  })

  it('removes a leftover worktree when a later pin fails, so nothing reads the old commit', () => {
    const failingFetch = (cwd: string, args: string[]) => {
      if (args[0] === 'fetch') {
        throw new Error('fatal: unable to access remote')
      }
      return defaultGit(cwd, args)
    }
    pinRepos(['svc-a'], path.join(root, 'src'), path.join(root, 'pinned'))
    const { skipped } = pinRepos(['svc-a'], path.join(root, 'src'), path.join(root, 'pinned'), failingFetch)
    expect(skipped.map(s => s.repo)).toEqual(['svc-a'])
    expect(fs.existsSync(path.join(root, 'pinned', 'svc-a'))).toBe(false)
  })

  it('re-pins an existing worktree in place', () => {
    const again = pinRepos(['svc-a'], path.join(root, 'src'), path.join(root, 'pinned'))
    expect(again.pinned).toHaveLength(1)
    expect(again.skipped).toEqual([])
  })
})

describe('buildGraphs', () => {
  it('builds a graph only when the existing one was not built at the pinned commit', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'graphs-'))
    const repo = { repo: 'svc-a', branch: 'master', sha: 'a'.repeat(40), dir }
    const runs: string[] = []
    const run = (cwd: string) => {
      runs.push(cwd)
      fs.mkdirSync(path.join(cwd, 'graphify-out'), { recursive: true })
      fs.writeFileSync(path.join(cwd, 'graphify-out', 'graph.json'), JSON.stringify({ built_at_commit: repo.sha, nodes: [], links: [] }))
    }
    expect(buildGraphs([repo], run)).toEqual([])
    expect(buildGraphs([repo], run)).toEqual([])
    expect(runs).toEqual([dir])
  })

  it('reports a failed build as a skip', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'graphs-'))
    const skips = buildGraphs([{ repo: 'svc-b', branch: 'master', sha: 'b'.repeat(40), dir }], () => {
      throw new Error('graphify not found')
    })
    expect(skips).toEqual([{ repo: 'svc-b', reason: 'graphify: graphify not found' }])
  })

  it('reports a missing binary by its spawn error', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'graphs-'))
    const skips = buildGraphs([{ repo: 'svc-c', branch: 'master', sha: 'c'.repeat(40), dir }], () => {
      throw Object.assign(new Error('spawnSync graphify ENOENT'), { stderr: undefined })
    })
    expect(skips).toEqual([{ repo: 'svc-c', reason: 'graphify: spawnSync graphify ENOENT' }])
  })
})

describe('applyModeError', () => {
  it('refuses --apply without --pinned, so the overlay and the monolith surface only come from production commits', () => {
    expect(applyModeError(['tsx', 'discover.ts', '--apply'])).toBe('--apply requires --pinned: the overlay, grades and monolith routes are written from production branches only')
    expect(applyModeError(['tsx', 'discover.ts', '--pinned', '--apply'])).toBeNull()
    expect(applyModeError(['tsx', 'discover.ts'])).toBeNull()
  })
})

describe('emptyPinError', () => {
  it('is null when at least one repo is pinned', () => {
    expect(emptyPinError(3, '/x')).toBeNull()
  })

  it('names the source base and the main-clone rule when no repo is pinned', () => {
    expect(emptyPinError(0, '/Users/me/Skello_Dev/dependency-explorer/.claude/worktrees')).toBe('--pinned pinned 0 repos: no Skello repos found under /Users/me/Skello_Dev/dependency-explorer/.claude/worktrees — run discovery from the main dependency-explorer clone, not from a worktree')
  })
})
