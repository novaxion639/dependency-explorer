import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectivityMap, resourceSurface } from '@dependency-explorer/data'

const REPO_BASE = process.env.REPO_BASE ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

function existsAt(repo: string, sha: string, file: string): boolean {
  try {
    execFileSync('git', ['-C', path.join(REPO_BASE, repo), 'cat-file', '-e', `${sha}:${file}`], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const missing = connectivityMap.flows.flatMap(f => (f.codeUnits ?? []).flatMap(u => {
  const pin = resourceSurface.pins[u.service]
  if (!u.path || !pin || !fs.existsSync(path.join(REPO_BASE, u.service))) {
    return []
  }
  return existsAt(u.service, pin, u.path) ? [] : [`${f.id} ${u.id} ${u.service}@${pin.slice(0, 7)} ${u.path}`]
}))
console.log(missing.length ? missing.join('\n') : 'every unit path exists at its pin')
process.exitCode = missing.length ? 1 : 0
