import * as fs from 'node:fs'
import * as path from 'node:path'
import { extractRailsSchema } from './extractors/rails-schema'
import { extractListeners } from './extractors/rails-listeners'
import { sourceFiles } from './extractors/queue-senders'
import { readRepoGraph } from './code-grades'
import { readerFor } from './code-wiring'
import { listenerSection } from './finding-sections'
import { headOf, PINNED_BASE } from './pinned'

const root = path.join(PINNED_BASE, 'skello-app')
const schema = extractRailsSchema(PINNED_BASE)
if (!schema) {
  console.error('skello-app is not pinned under .pinned/')
  process.exitCode = 1
} else {
  const files = ['app', 'lib'].flatMap(d => sourceFiles(path.join(root, d))).filter(f => f.endsWith('.rb')).map(f => ({ file: path.relative(root, f), source: fs.readFileSync(f, 'utf-8') }))
  const head = headOf('skello-app')
  const parsed = readRepoGraph(root)
  const result = extractListeners({ models: schema.models, tables: schema.tables, files, read: readerFor(root), graph: parsed && parsed.builtAt === head ? parsed : null })
  console.log(listenerSection({ findings: result.findings, listeners: result.listeners.length, writeSites: result.writeSites.length, feeds: null, skipped: false }))
  const byTable = new Map<string, number>()
  for (const l of result.listeners) {
    byTable.set(l.table, (byTable.get(l.table) ?? 0) + 1)
  }
  console.log([...byTable].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t, n]) => `${n}\t${t}`).join('\n'))
}
