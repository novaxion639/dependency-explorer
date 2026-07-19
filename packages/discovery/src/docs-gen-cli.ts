import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectivityMap } from '@dependency-explorer/data'
import { renderFlowInventorySection, renderPlanningCoverageSection, applyGenerated } from './docs-gen'

// `pnpm docs:gen` — rewrite the generated sections of the inventory docs.
const here = path.dirname(fileURLToPath(import.meta.url))
const docsDir = path.resolve(here, '..', '..', '..', 'docs')

const targets: Array<{ file: string; name: string; section: string }> = [
  { file: 'flow-inventory.md', name: 'flows-by-domain', section: renderFlowInventorySection(connectivityMap) },
  { file: 'planning-actions-coverage.md', name: 'planning-flows', section: renderPlanningCoverageSection(connectivityMap) },
]

for (const t of targets) {
  const p = path.join(docsDir, t.file)
  const next = applyGenerated(fs.readFileSync(p, 'utf-8'), t.name, t.section)
  fs.writeFileSync(p, next)
  console.log(`docs:gen — ${t.file} § ${t.name} rewritten`)
}
