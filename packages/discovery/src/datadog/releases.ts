import { defaultGit, type GitRunner } from '../pinned'
import type { EngineInput } from './health/rules'

const PR_NUMBER = /Merge pull request #(\d+)/

export function releasesOf(repoDir: string, repo: string, branch: 'master' | 'main', since: Date, git: GitRunner = defaultGit): EngineInput['releases'] {
  const log = git(repoDir, ['log', '--first-parent', '--merges', `--since=${since.toISOString()}`, '--format=%H%x09%cI%x09%s', branch])
  return log
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => {
      const [sha, merged, ...subject] = line.split('\t')
      const title = subject.join('\t')
      return { repo, number: Number(PR_NUMBER.exec(title)?.[1] ?? 0), sha, title, merged, changes: [] }
    })
}
