/**
 * Flow-authoring assist: list the code units a Ruby file invokes, so a human
 * can author a flow's code layer from evidence instead of memory.
 *
 *   pnpm discover:trace ../skello-app/app/services/v3/shifts/create_service.rb
 *
 * This ASSISTS authoring — it never generates flow data (humans own meaning,
 * ADR-0007). Output: invoked constants with line numbers, kind guesses, and
 * AR callback declarations.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const INVOKE_RE = /([A-Z][A-Za-z0-9_]*(?:::[A-Z][A-Za-z0-9_]*)*)\s*(?:\.new\b|\.perform_async\b|\.perform_later\b|\.perform_now\b|\.run\b|\.call\b|\.create!?\b)/g
const CALLBACK_RE = /^\s*(after_save|after_commit|after_create|after_destroy|before_save)\s+:(\w+)/
const IGNORED_CONSTANTS = new Set([
  'ActiveRecord', 'ApplicationRecord', 'DateTime', 'Date', 'Time', 'I18n', 'JSON',
  'Rails', 'Skello', 'ENV', 'Hash', 'Array', 'String', 'Integer', 'Float', 'Struct', 'OpenStruct',
])

function kindGuess(constant: string): string {
  if (/Job$/.test(constant)) return 'job'
  if (/Controller(#|$)/.test(constant)) return 'controller'
  if (/(Manager)$/.test(constant)) return 'manager'
  if (/(Service)$/.test(constant)) return 'service'
  return 'service?'
}

const fileArg = process.argv[2]
if (!fileArg) {
  console.error('usage: pnpm discover:trace <repo>/<path/to/file.rb>  (repo-root-relative or absolute)')
  process.exit(1)
}
// Try as given (absolute / cwd-relative), then against the repos base —
// so `skello-app/app/services/…` works from anywhere in the workspace.
const REPO_BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../')
const candidates = [
  path.resolve(fileArg),
  path.join(REPO_BASE, fileArg.replace(/^(\.\.\/)+/, '')),
]
const filePath = candidates.find(p => fs.existsSync(p))
if (!filePath) {
  console.error(`cannot read ${fileArg} (tried: ${candidates.join(', ')})`)
  process.exit(1)
}
const content = fs.readFileSync(filePath, 'utf-8')

console.log(`# trace: ${fileArg}\n`)

const seen = new Map<string, Array<{ line: number; verb: string }>>()
content.split('\n').forEach((line, i) => {
  for (const m of line.matchAll(INVOKE_RE)) {
    const constant = m[1]!
    const root = constant.split('::')[0]!
    if (IGNORED_CONSTANTS.has(root)) continue
    const verb = m[0]!.slice(constant.length).trim()
    if (!seen.has(constant)) seen.set(constant, [])
    seen.get(constant)!.push({ line: i + 1, verb })
  }
})

if (seen.size) {
  console.log('## invoked constants (codeUnit candidates)\n')
  for (const [constant, hits] of [...seen.entries()].sort((a, b) => a[1][0]!.line - b[1][0]!.line)) {
    const lines = hits.map(h => `L${h.line} ${h.verb}`).join(', ')
    console.log(`- ${constant}  [${kindGuess(constant)}]  (${lines})`)
  }
} else {
  console.log('_no constant invocations found_')
}

const callbacks: string[] = []
content.split('\n').forEach((line, i) => {
  const m = line.match(CALLBACK_RE)
  if (m) callbacks.push(`- L${i + 1} ${m[1]} :${m[2]}`)
})
if (callbacks.length) {
  console.log('\n## AR callbacks declared (model-callback group candidates)\n')
  console.log(callbacks.join('\n'))
}

console.log('\n_Author codeUnits/codeEdges by hand from this evidence — verify with `pnpm discover` (🫀 section)._')
