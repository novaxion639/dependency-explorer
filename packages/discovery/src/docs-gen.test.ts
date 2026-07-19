import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectivityMap } from '@dependency-explorer/data'
import { renderFlowInventorySection, renderPlanningCoverageSection, extractGenerated, applyGenerated, extractCitedFlowIds, MARKERS } from './docs-gen'

// The staleness gate: committed generated sections must match the dataset.
// Self-contained — reads only this repo's docs/, no sibling checkouts.
const docsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'docs')

describe('generated inventory docs', () => {
  const cases = [
    { file: 'flow-inventory.md', name: 'flows-by-domain', render: renderFlowInventorySection },
    { file: 'planning-actions-coverage.md', name: 'planning-flows', render: renderPlanningCoverageSection },
  ] as const

  for (const c of cases) {
    it(`${c.file} § ${c.name} matches the dataset (run \`pnpm docs:gen\` on drift)`, () => {
      const content = fs.readFileSync(path.join(docsDir, c.file), 'utf-8')
      const committed = extractGenerated(content, c.name)
      expect(committed, `markers for "${c.name}" missing in ${c.file}`).not.toBeNull()
      expect(committed).toBe(c.render(connectivityMap).trim())
    })
  }

  it('every ✅ flow id cited in planning-actions-coverage.md exists in the dataset', () => {
    const content = fs.readFileSync(path.join(docsDir, 'planning-actions-coverage.md'), 'utf-8')
    const flowIds = new Set(connectivityMap.flows.map(f => f.id))
    for (const cited of extractCitedFlowIds(content)) {
      expect(flowIds.has(cited), `doc cites unknown flow \`${cited}\``).toBe(true)
    }
  })

  it('applyGenerated round-trips through extractGenerated', () => {
    const doc = `intro\n${MARKERS.begin('x')}\nold\n${MARKERS.end('x')}\noutro`
    const next = applyGenerated(doc, 'x', 'new content')
    expect(extractGenerated(next, 'x')).toBe('new content')
    expect(next.startsWith('intro')).toBe(true)
    expect(next.endsWith('outro')).toBe(true)
  })
})
