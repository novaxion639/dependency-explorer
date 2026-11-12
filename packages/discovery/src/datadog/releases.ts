import { defaultGit, type GitRunner } from '../pinned'
import type { EngineInput } from './health/rules'

export const PR_NUMBER = /Merge pull request #(\d+)/

const firstLine = (text: string): string | undefined =>
  text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line !== '')

export interface Merge { sha: string; mergedAt: string; subject: string; title: string }

export function mergesOf(repoDir: string, revisions: string[], git: GitRunner = defaultGit): Merge[] {
  const log = git(repoDir, ['log', '-z', '--merges', '--format=%H%x09%cI%x09%s%x09%b', ...revisions])
  return log
    .split('\0')
    .filter((record) => record.trim() !== '')
    .map((record) => {
      const [sha, mergedAt, subject, ...body] = record.trim().split('\t')
      return { sha, mergedAt, subject, title: firstLine(body.join('\t')) ?? subject }
    })
}

export function releasesOf(repoDir: string, repo: string, ref: string, since: Date, git: GitRunner = defaultGit): EngineInput['releases'] {
  return mergesOf(repoDir, ['--first-parent', `--since=${since.toISOString()}`, ref], git).map(({ sha, mergedAt, subject, title }) => ({
    repo,
    number: Number(PR_NUMBER.exec(subject)?.[1] ?? 0),
    sha,
    title,
    merged: mergedAt,
    changes: [],
  }))
}
