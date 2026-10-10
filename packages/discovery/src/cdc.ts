import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Resource, ResourceRelation } from '@dependency-explorer/schema'
import { escapeRegExp, readerFor, type Read } from './code-wiring'
import type { TerraformFacts, TfDmsTask } from './extractors/terraform'
import type { ServerlessFacts, StreamConsumerFact } from './extractors/serverless'
import type { ListenerFinding } from './extractors/rails-listeners'
import { tableId } from './resource-registry'
import { MONOLITH, dmsSourceRepo, dmsTaskStream } from './resource-relations'

const CDC_MIGRATIONS = new Set(['cdc', 'full-load-and-cdc'])
const EXEMPT_TABLES = new Set(['ar_internal_metadata', 'schema_migrations', 'pg_stat_statements'])
const FILE_CALL = /^file\(\s*"([^"]+)"\s*\)$/
const TEMPLATE_CALL = /^templatefile\(\s*"([^"]+)"\s*,\s*\{([\s\S]*)\}\s*\)$/
const TEMPLATE_LOOP = /\bfor\s+\w+\s+in\s+(\w+)\b/
const TABLE_NAME = /"table-name"\s*[:=]\s*"([^"$]+)"/g

function tfPath(raw: string): string {
  return raw.replace(/^\$\{path\.module\}\//, '').replace(/^\.\//, '')
}

export function terraformList(contents: string[], name: string): string[] {
  for (const content of contents) {
    const m = new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*\\[([^\\]]*)\\]`).exec(content.replace(/^\s*#.*$/gm, ''))
    if (m) {
      return [...(m[1] ?? '').matchAll(/"([^"]+)"/g)].map(x => x[1] ?? '')
    }
  }
  return []
}

const SELECTION = /"rule-type"\s*[:=]\s*"selection"/
const INCLUDE = /"rule-action"\s*[:=]\s*"include"/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function withWildcard(names: string[], schemaTables: string[]): string[] {
  const unique = [...new Set(names)]
  return unique.includes('%') ? schemaTables : unique
}

function jsonIncludedTables(raw: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    const rules = isRecord(parsed) && Array.isArray(parsed.rules) ? parsed.rules : []
    return rules.flatMap(rule => {
      const locator = isRecord(rule) ? rule['object-locator'] : undefined
      const name = isRecord(locator) ? locator['table-name'] : undefined
      return isRecord(rule) && rule['rule-type'] === 'selection' && rule['rule-action'] === 'include' && typeof name === 'string' ? [name] : []
    })
  } catch {
    return null
  }
}

function ruleObjects(text: string): string[] {
  const stack: Array<{ start: number; hasRuleInside: boolean }> = []
  const rules: string[] = []
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      stack.push({ start: i, hasRuleInside: false })
    } else if (text[i] === '}') {
      const open = stack.pop()
      if (!open) {
        continue
      }
      const segment = text.slice(open.start, i + 1)
      const isRule = !open.hasRuleInside && segment.includes('"rule-type"')
      if (isRule) {
        rules.push(segment)
      }
      const parent = stack[stack.length - 1]
      if (parent && (isRule || open.hasRuleInside)) {
        parent.hasRuleInside = true
      }
    }
  }
  return rules
}

function tablesIn(mapping: string, schemaTables: string[]): string[] {
  const names = ruleObjects(mapping)
    .filter(rule => SELECTION.test(rule) && INCLUDE.test(rule))
    .flatMap(rule => [...rule.matchAll(TABLE_NAME)].map(m => m[1] ?? ''))
  return withWildcard(names, schemaTables)
}

function fileTables(raw: string, schemaTables: string[]): string[] {
  const names = jsonIncludedTables(raw)
  return names ? withWildcard(names, schemaTables) : tablesIn(raw, schemaTables)
}

export function cdcTables(task: TfDmsTask, read: Read, contents: string[], schemaTables: string[]): string[] {
  const expr = (task.tableMappings ?? '').replace(/\s+/g, ' ').trim()
  const file = FILE_CALL.exec(expr)
  if (file) {
    return fileTables(read(tfPath(file[1] ?? '')) ?? '', schemaTables)
  }
  const template = TEMPLATE_CALL.exec(expr)
  if (!template) {
    return []
  }
  const body = read(tfPath(template[1] ?? '')) ?? ''
  const loopVar = TEMPLATE_LOOP.exec(body)?.[1]
  const local = loopVar ? new RegExp(`\\b${loopVar}\\s*=\\s*local\\.(\\w+)`).exec(template[2] ?? '')?.[1] : undefined
  return local ? terraformList(contents, local) : tablesIn(body, schemaTables)
}

export function consumerRelations(stream: { id: string; name: string }, tables: string[], consumers: Map<string, StreamConsumerFact[]>): ResourceRelation[] {
  return [...consumers].flatMap(([repo, facts]) => facts
    .filter(c => c.stream === stream.name && c.enabled !== false)
    .flatMap(c => tables.filter(t => (c.tablePrefixes ?? []).some(p => `public.${t}.`.startsWith(p))).map(t => {
      const relation: ResourceRelation = { resource: tableId(t), relation: 'consumes', service: repo, target: stream.id, ...(c.file ? { file: c.file } : {}), grade: 'config' }
      return relation
    })))
}

function tfContents(dir: string): string[] {
  try {
    return fs.readdirSync(dir).filter(f => f.endsWith('.tf')).map(f => fs.readFileSync(path.join(dir, f), 'utf-8'))
  } catch {
    return []
  }
}

export function cdcRelations(input: { terraform: Array<{ service: string; tfRepo: string; facts: TerraformFacts }>; resources: Resource[]; serverless: Map<string, ServerlessFacts>; schemaTables: string[]; repoBase: string }): { relations: ResourceRelation[]; findings: ListenerFinding[] } {
  const repos = [...new Set([MONOLITH, ...input.resources.flatMap(r => (r.owner ? [r.owner] : [])), ...input.terraform.map(t => t.service)])]
  const schema = new Set(input.schemaTables)
  const consumers = new Map([...input.serverless].map(([repo, facts]) => [repo, facts.streamConsumers]))
  const relations: ResourceRelation[] = []
  const findings = new Map<string, ListenerFinding>()
  for (const t of input.terraform) {
    const dir = path.join(input.repoBase, t.tfRepo)
    const contents = tfContents(dir)
    for (const task of t.facts.dmsTasks) {
      if (!CDC_MIGRATIONS.has(task.migrationType ?? '') || task.count?.trim() === '0' || dmsSourceRepo(task.source, repos, t.service) !== MONOLITH) {
        continue
      }
      const stream = dmsTaskStream(t, task, input.resources)
      if (!stream) {
        continue
      }
      const tables = cdcTables(task, readerFor(dir), contents, input.schemaTables)
      for (const table of tables.filter(x => !schema.has(x) && !EXEMPT_TABLES.has(x))) {
        const finding: ListenerFinding = { kind: 'cdc-unknown-table', subject: table, detail: `${t.tfRepo}:${task.label} selects ${table}, absent from db/schema.rb` }
        findings.set(`${finding.subject}|${finding.detail}`, finding)
      }
      const known = tables.filter(x => schema.has(x))
      relations.push(...known.map(table => {
        const relation: ResourceRelation = { resource: tableId(table), relation: 'feeds', service: MONOLITH, target: stream.id, grade: 'config' }
        return relation
      }), ...consumerRelations(stream, known, consumers))
    }
  }
  return { relations, findings: [...findings.values()] }
}
