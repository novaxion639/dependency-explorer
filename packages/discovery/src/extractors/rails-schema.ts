import * as fs from 'node:fs'
import * as path from 'node:path'
import { pluralize, singularize } from './rails-routes'
import { stripComments } from '../code-grades'

export interface RailsModel { className: string; file: string; table: string; associations: string[] }

const RECORD_BASE = /^\s*class\s+(\w+)\s*<\s*(ApplicationRecord|ActiveRecord::Base)\b/m
const ASSOCIATION = /^\s*(belongs_to|has_many|has_one|has_and_belongs_to_many)\s+:(\w+)([^\n]*)$/gm

export function parseSchemaTables(schemaRb: string): string[] {
  return [...schemaRb.matchAll(/create_table\s+"([^"]+)"/g)].flatMap(m => (m[1] ? [m[1]] : [])).sort()
}

export function underscore(className: string): string {
  return className.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

export function tableize(className: string): string {
  return pluralize(underscore(className))
}

export function parseModelFile(file: string, source: string): RailsModel | null {
  const code = stripComments(source)
  const record = code.match(RECORD_BASE)
  if (!record || /self\.abstract_class\s*=\s*true/.test(code)) {
    return null
  }
  const className = record[1] ?? ''
  const explicit = code.match(/self\.table_name\s*=\s*['"](\w+)['"]/)?.[1]
  const associations = new Set<string>()
  for (const m of code.matchAll(ASSOCIATION)) {
    const target = m[3]?.match(/class_name:\s*['"]([\w:]+)['"]/)?.[1]
    associations.add(target ? tableize(target.split('::').pop() ?? target) : pluralize(singularize(m[2] ?? '')))
  }
  return { className, file, table: explicit ?? tableize(className), associations: [...associations].sort() }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []) {
    const full = path.join(dir, e.name)
    if (e.isDirectory() && e.name !== 'concerns') {
      walk(full, out)
    } else if (e.isFile() && e.name.endsWith('.rb')) {
      out.push(full)
    }
  }
  return out
}

export function extractRailsSchema(repoBase: string, repo = 'skello-app'): { tables: string[]; models: RailsModel[] } | null {
  const root = path.join(repoBase, repo)
  const schemaFile = path.join(root, 'db', 'schema.rb')
  if (!fs.existsSync(schemaFile)) {
    return null
  }
  const models = walk(path.join(root, 'app', 'models')).flatMap(f => {
    const model = parseModelFile(path.relative(root, f), fs.readFileSync(f, 'utf-8'))
    return model ? [model] : []
  })
  return { tables: parseSchemaTables(fs.readFileSync(schemaFile, 'utf-8')), models }
}
