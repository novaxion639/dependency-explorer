import type { Runs, WriteEvent } from '@dependency-explorer/schema'
import { escapeRegExp, receiverClass } from '../code-wiring'

export interface WriteKind { runs: Runs; events: WriteEvent[] }
export interface WriteResolver { byClass: Map<string, { table: string }>; classes: Set<string>; associations: Map<string, Set<string>> }
export interface SourceLine { text: string; line: number }
export interface WriteHit { table: string; call: string; kind: WriteKind; grade: 'constant' | 'text'; line: number }

const kind = (runs: Runs, ...events: WriteEvent[]): WriteKind => ({ runs, events })

export const WRITE_KINDS: Record<string, WriteKind> = {
  save: kind('all', 'create', 'update'),
  'save!': kind('all', 'create', 'update'),
  create: kind('all', 'create'),
  'create!': kind('all', 'create'),
  update: kind('all', 'update'),
  'update!': kind('all', 'update'),
  update_attribute: kind('all', 'update'),
  destroy: kind('all', 'destroy'),
  'destroy!': kind('all', 'destroy'),
  destroy_all: kind('all', 'destroy'),
  destroy_by: kind('all', 'destroy'),
  find_or_create_by: kind('all', 'create', 'update'),
  'find_or_create_by!': kind('all', 'create', 'update'),
  first_or_create: kind('all', 'create', 'update'),
  'first_or_create!': kind('all', 'create', 'update'),
  create_or_find_by: kind('all', 'create', 'update'),
  'create_or_find_by!': kind('all', 'create', 'update'),
  touch: kind('touch', 'update'),
  update_all: kind('none', 'update'),
  update_column: kind('none', 'update'),
  update_columns: kind('none', 'update'),
  delete: kind('none', 'destroy'),
  delete_all: kind('none', 'destroy'),
  delete_by: kind('none', 'destroy'),
  insert: kind('none', 'create'),
  'insert!': kind('none', 'create'),
  insert_all: kind('none', 'create'),
  'insert_all!': kind('none', 'create'),
  upsert: kind('none', 'create', 'update'),
  upsert_all: kind('none', 'create', 'update'),
  import: kind('validation', 'create'),
  'import!': kind('validation', 'create'),
}

const NAMES = Object.keys(WRITE_KINDS).sort((a, b) => b.length - a.length).map(escapeRegExp).join('|')
const WRITE_CALL = new RegExp(`\\.(${NAMES})(?![\\w!?])`, 'g')
const BARE_WRITE = new RegExp(`^\\s*(${NAMES})(?![\\w!?])`)
const QUERY_HEADS = new Set(['where', 'unscoped', 'all', 'joins', 'includes', 'find', 'find_by', 'find_each', 'order', 'limit', 'not', 'lock', 'first_or_initialize', 'find_or_initialize_by'])
const PARENS = /\([^()]*\)/g
const CHAIN = /(@?[A-Za-z_][\w:]*[!?]?)(?:\(\))?((?:&?\.[A-Za-z_]\w*[!?]?(?:\(\))?)*)&?\s*$/
const SQL_INSERT = /\bINSERT\s+INTO\s+"?(\w+)"?/gi
const SQL_UPDATE = /\bUPDATE\s+"?(\w+)"?\s+SET\b/gi
const SQL_DELETE = /\bDELETE\s+FROM\s+"?(\w+)"?/gi
const UPSERT = /\bON\s+CONFLICT\b[\s\S]*\bDO\s+UPDATE\b/i

export function linesOf(text: string, firstLine: number): SourceLine[] {
  return text.split('\n').map((t, i) => ({ text: t, line: firstLine + i }))
}

export function writeKind(call: string, window: string): WriteKind | null {
  if (!(call in WRITE_KINDS)) {
    return null
  }
  const base = WRITE_KINDS[call]
  if (base === undefined) {
    return null
  }
  if (call.startsWith('import') && /validate:\s*false/.test(window)) {
    return kind('none', ...base.events)
  }
  if (base.runs === 'all' && /\.(first_or_initialize|find_or_initialize_by)\b/.test(window)) {
    return kind('all', 'create', 'update')
  }
  return base
}

function flatten(prefix: string): string {
  const once = prefix.replace(PARENS, '()')
  return once === prefix ? prefix : flatten(once)
}

export function receiverOf(prefix: string, self: { table: string } | null, ctx: WriteResolver): { table: string; grade: 'constant' | 'text' } | null {
  const m = CHAIN.exec(flatten(prefix))
  if (!m) {
    return null
  }
  const head = (m[1] ?? '').replace(/^@/, '')
  const headModel = ctx.byClass.get(head.split('::').pop() ?? head)
  if (headModel) {
    return { table: headModel.table, grade: 'constant' }
  }
  const segments = (m[2] ?? '').split('.').map(s => s.replace(/[&()]/g, '')).filter(s => s !== '')
  const named = [head, ...segments].filter(s => !QUERY_HEADS.has(s))
  const word = named[named.length - 1]
  if (word === undefined || word === 'self') {
    return self ? { table: self.table, grade: 'constant' } : null
  }
  const cls = receiverClass(word, ctx.classes, ctx.associations, true)
  const model = cls === null ? undefined : ctx.byClass.get(cls)
  return model ? { table: model.table, grade: 'text' } : null
}

export function writesIn(lines: SourceLine[], self: { table: string } | null, ctx: WriteResolver): WriteHit[] {
  return lines.flatMap(({ text, line }, i) => {
    const window = lines.slice(i, i + 6).map(l => l.text).join(' ')
    const hits: WriteHit[] = []
    const bare = self ? BARE_WRITE.exec(text) : null
    const bareKind = bare ? writeKind(bare[1] ?? '', window) : null
    if (self && bare && bareKind) {
      hits.push({ table: self.table, call: bare[1] ?? '', kind: bareKind, grade: 'constant', line })
    }
    for (const m of text.matchAll(WRITE_CALL)) {
      const call = m[1] ?? ''
      const found = writeKind(call, window)
      const target = found ? receiverOf(text.slice(0, m.index ?? 0), self, ctx) : null
      if (found && target) {
        hits.push({ table: target.table, call, kind: found, grade: target.grade, line })
      }
    }
    return hits
  })
}

export function sqlWritesIn(lines: SourceLine[], tables: Set<string>): WriteHit[] {
  const upsert = UPSERT.test(lines.map(l => l.text).join('\n'))
  const forms: Array<{ re: RegExp; call: string; found: WriteKind }> = [
    { re: SQL_INSERT, call: 'SQL INSERT INTO', found: upsert ? kind('none', 'create', 'update') : kind('none', 'create') },
    { re: SQL_UPDATE, call: 'SQL UPDATE', found: kind('none', 'update') },
    { re: SQL_DELETE, call: 'SQL DELETE FROM', found: kind('none', 'destroy') },
  ]
  return lines.flatMap(({ text, line }) => forms.flatMap(({ re, call, found }) => [...text.matchAll(re)].flatMap(m => {
    const hit: WriteHit = { table: m[1] ?? '', call, kind: found, grade: 'constant', line }
    return tables.has(hit.table) ? [hit] : []
  })))
}
