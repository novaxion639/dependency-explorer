import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectivityMap, resourceSurface } from '@dependency-explorer/data'
import { checkUnitPaths } from './unit-paths'

const REPO_BASE = process.env.REPO_BASE ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

function existsAt(repo: string, sha: string, file: string): boolean {
  try {
    execFileSync('git', ['-C', path.join(REPO_BASE, repo), 'cat-file', '-e', `${sha}:${file}`], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const units = connectivityMap.flows.flatMap(f => (f.codeUnits ?? []).map(u => ({ flow: f.id, id: u.id, service: u.service, path: u.path })))
const { missing, skipped } = checkUnitPaths(units, s => resourceSurface.pins[s], s => fs.existsSync(path.join(REPO_BASE, s)), existsAt)
console.log(missing.length ? missing.join('\n') : 'every unit path exists at its pin')
console.log(`${skipped} units skipped (repo not cloned or not pinned)`)
process.exitCode = missing.length ? 1 : 0
