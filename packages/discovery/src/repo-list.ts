import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectivityMap } from '@dependency-explorer/data'
import { TF_REPO_SERVICE_OVERRIDES } from './mapping'
import { readBaselineRepos } from './baseline'

const BASELINE_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../baseline.json')

const repos = new Set<string>(['skello-libs-ts', ...readBaselineRepos(BASELINE_PATH)])
for (const s of connectivityMap.services) {
  repos.add(s.name)
  repos.add(`${s.name}-tf`)
}
for (const tf of Object.keys(TF_REPO_SERVICE_OVERRIDES)) {
  repos.add(tf)
}
console.log([...repos].sort().join('\n'))
