import * as fs from 'node:fs'
import * as path from 'node:path'
import { walkFiles } from '../code-wiring'

export interface QueueSenderEvidence {
  from: string
  to: string
  /** queue names found as literals in the sender's source */
  queues: string[]
  /** sample of files containing the literals */
  files: string[]
}

const SOURCE_DIRS = ['src', 'app', 'lib', 'apps', 'shared', 'config']
const SOURCE_EXTS = new Set(['.ts', '.js', '.rb', '.yml', '.yaml'])
const SKIP_DIRS = new Set(['node_modules', 'dist', 'spec', 'test', '__tests__', 'coverage', 'tmp', 'log', 'vendor'])
const MAX_FILE_SIZE = 400 * 1024
const MIN_QUEUE_NAME_LENGTH = 8
const SAMPLE_CAP = 3

export function sourceFiles(dir: string): string[] {
  return walkFiles(dir, f => SOURCE_EXTS.has(path.extname(f)) && !/\.(test|spec)\./.test(path.basename(f)) && fs.statSync(f).size <= MAX_FILE_SIZE, name => SKIP_DIRS.has(name) || name.startsWith('.'))
}

/**
 * Cross-reference queue names against every repo's source: a repo containing
 * the literal name of a queue consumed/owned by another service is evidence
 * of an async (SQS) sender → consumer connection.
 */
export function findQueueSenders(
  repoBase: string,
  repos: string[],
  queueOwners: Map<string, string>, // queue name → owning/consuming service
): QueueSenderEvidence[] {
  // Only service-prefixed queue names (svcPunchMergeShop…) are safe to
  // cross-reference. Generic names collide: "mergeShopSqs" matched a CONSUMER
  // handler in another service (both subscribe to the same shop-merge fan-out)
  // and briefly fabricated a sender edge. "full-load" matched unrelated
  // constants. Anything unprefixed stays out of cross-repo matching.
  const searchable = [...queueOwners.entries()]
    .filter(([name]) => name.length >= MIN_QUEUE_NAME_LENGTH && /^svc[A-Z]/.test(name))

  if (!searchable.length) return []

  const results = new Map<string, QueueSenderEvidence>() // "from→to"

  for (const repo of repos) {
    const repoPath = path.join(repoBase, repo)
    const files = SOURCE_DIRS
      .map(d => path.join(repoPath, d))
      .filter(d => fs.existsSync(d))
      .flatMap(d => sourceFiles(d))

    for (const file of files) {
      let content: string
      try {
        content = fs.readFileSync(file, 'utf-8')
      } catch {
        continue
      }

      for (const [queue, owner] of searchable) {
        if (owner === repo) continue // a service referencing its own queues is not a connection
        if (!content.includes(queue)) continue
        const key = `${repo}→${owner}`
        const entry = results.get(key) ?? { from: repo, to: owner, queues: [], files: [] }
        if (!entry.queues.includes(queue)) entry.queues.push(queue)
        const rel = path.relative(repoPath, file)
        if (entry.files.length < SAMPLE_CAP && !entry.files.includes(rel)) entry.files.push(rel)
        results.set(key, entry)
      }
    }
  }

  return [...results.values()]
}
