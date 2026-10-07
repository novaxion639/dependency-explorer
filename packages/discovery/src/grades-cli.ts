import * as path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { connectivityMap } from '@dependency-explorer/data'
import { checkCodeGrades } from './code-grades'
import { extractRailsRoutes } from './extractors/rails-routes'

const PINNED_BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.pinned')

function headOf(repo: string): string | null {
  try {
    return execFileSync('git', ['-C', path.join(PINNED_BASE, repo), 'rev-parse', 'HEAD'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

const { distribution, findings } = checkCodeGrades(connectivityMap, PINNED_BASE, headOf, extractRailsRoutes(PINNED_BASE)?.routes ?? [])
console.log(JSON.stringify(distribution))
for (const f of findings) {
  console.log(`${f.kind} ${f.subject} — ${f.detail}`)
}
