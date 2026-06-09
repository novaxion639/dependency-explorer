import * as fs from 'node:fs'
import * as path from 'node:path'

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

function walkFiles(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walkFiles(full, out)
    else if (SOURCE_EXTS.has(path.extname(e.name)) && !/\.(test|spec)\./.test(e.name)) out.push(full)
  }
  return out
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
  // Generic lowercase names ("full-load") false-positive across repos; real
  // Skello queue names are camelCase or digit-suffixed (svcEmployeesUpdate,
  // mergeShopSqs) — require at least one uppercase letter or digit.
  const searchable = [...queueOwners.entries()]
    .filter(([name]) => name.length >= MIN_QUEUE_NAME_LENGTH && /[A-Z0-9]/.test(name))

  if (!searchable.length) return []

  const results = new Map<string, QueueSenderEvidence>() // "from→to"

  for (const repo of repos) {
    const repoPath = path.join(repoBase, repo)
    const files = SOURCE_DIRS
      .map(d => path.join(repoPath, d))
      .filter(d => fs.existsSync(d))
      .flatMap(d => walkFiles(d))

    for (const file of files) {
      let content: string
      try {
        if (fs.statSync(file).size > MAX_FILE_SIZE) continue
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
