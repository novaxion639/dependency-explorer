import { connectivityMap } from '@dependency-explorer/data'
import { checkCodeGrades } from './code-grades'
import { extractRailsRoutes } from './extractors/rails-routes'
import { headOf, PINNED_BASE } from './pinned'

const { distribution, findings } = checkCodeGrades(connectivityMap, PINNED_BASE, headOf, extractRailsRoutes(PINNED_BASE)?.routes ?? [])
console.log(JSON.stringify(distribution))
for (const f of findings) {
  console.log(`${f.kind} ${f.subject} — ${f.detail}`)
}
