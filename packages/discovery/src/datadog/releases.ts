import { defaultGit, type GitRunner } from '../pinned'
import type { EngineInput } from './health/rules'

const PR_NUMBER = /Merge pull request #(\d+)/

const firstLine = (text: string): string | undefined =>
  text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line !== '')

export function releasesOf(repoDir: string, repo: string, ref: string, since: Date, git: GitRunner = defaultGit): EngineInput['releases'] {
  const log = git(repoDir, ['log', '-z', '--first-parent', '--merges', `--since=${since.toISOString()}`, '--format=%H%x09%cI%x09%s%x09%b', ref])
  return log
    .split('\0')
    .filter((record) => record.trim() !== '')
    .map((record) => {
      const [sha, merged, subject, ...body] = record.trim().split('\t')
      return { repo, number: Number(PR_NUMBER.exec(subject)?.[1] ?? 0), sha, title: firstLine(body.join('\t')) ?? subject, merged, changes: [] }
    })
}
