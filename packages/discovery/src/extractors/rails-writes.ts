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
const BARE_WRITE = new RegExp(`^\\s*(${NAMES})(?![\\w!?:])`)
const QUERY_HEADS = new Set(['where', 'unscoped', 'all', 'joins', 'includes', 'find', 'find_by', 'find_each', 'order', 'limit', 'not', 'lock', 'first_or_initialize', 'find_or_initialize_by'])
const FIRST_OR_INITIALIZE_OVERRIDES = new Set(['save', 'save!', 'create', 'create!', 'update', 'update!'])
const FIRST_OR_INITIALIZE = /(?:^|\.)(first_or_initialize|find_or_initialize_by)\b/
const PARENS = /\([^()]*\)/g
const COLLAPSED = '\u0001'
const CHAIN = /(@?[A-Za-z_][\w:]*[!?]?)(?:\(\))?((?:\s*&?\.[A-Za-z_]\w*[!?]?(?:\(\))?)*)\s*&?\s*$/
const CONTINUATION = /^&?\./
const OPEN_BRACKETS = new Set(['(', '['])
const CLOSE_BRACKETS = new Set([')', ']'])
const SQL_INSERT = /\bINSERT\s+INTO\s+"?(\w+)"?/gi
const SQL_UPDATE = /\bUPDATE\s+"?(\w+)"?\s+SET\b/gi
const SQL_DELETE = /\bDELETE\s+FROM\s+"?(\w+)"?/gi
const UPSERT = /\bON\s+CONFLICT\b[\s\S]*\bDO\s+UPDATE\b/i

export function linesOf(text: string, firstLine: number): SourceLine[] {
  return text.split('\n').map((t, i) => ({ text: t, line: firstLine + i }))
}

function bracketDepth(text: string): number {
  let depth = 0
  for (const ch of text) {
    if (OPEN_BRACKETS.has(ch)) {
      depth++
    } else if (CLOSE_BRACKETS.has(ch)) {
      depth--
    }
  }
  return depth
}

export function joinStatements(lines: SourceLine[]): SourceLine[] {
  const out: SourceLine[] = []
  let pending: SourceLine | undefined
  for (const { text, line } of lines) {
    const trimmed = text.trim()
    if (pending !== undefined && (bracketDepth(pending.text) > 0 || CONTINUATION.test(trimmed))) {
      pending = { text: `${pending.text} ${trimmed}`, line: pending.line }
    } else {
      if (pending !== undefined) {
        out.push(pending)
      }
      pending = { text: trimmed, line }
    }
  }
  if (pending !== undefined) {
    out.push(pending)
  }
  return out
}

function argumentsAt(text: string, from: number): string {
  if (text.charAt(from) !== '(') {
    return ''
  }
  let depth = 0
  for (let i = from; i < text.length; i++) {
    const ch = text.charAt(i)
    if (ch === '(') {
      depth++
    } else if (ch === ')') {
      depth--
      if (depth === 0) {
        return text.slice(from + 1, i)
      }
    }
  }
  return text.slice(from + 1)
}

export function writeKind(call: string, receiver: string, args: string): WriteKind | null {
  if (!Object.hasOwn(WRITE_KINDS, call)) {
    return null
  }
  const base = WRITE_KINDS[call]
  if (call.startsWith('import') && /validate:\s*false/.test(args)) {
    return kind('none', ...base.events)
  }
  if (FIRST_OR_INITIALIZE_OVERRIDES.has(call) && FIRST_OR_INITIALIZE.test(receiver)) {
    return kind('all', 'create', 'update')
  }
  return kind(base.runs, ...base.events)
}

function flatten(prefix: string): string {
  const once = prefix.replace(PARENS, COLLAPSED)
  return once === prefix ? prefix.replaceAll(COLLAPSED, '()') : flatten(once)
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
  const segments = (m[2] ?? '').split('.').map(s => s.replace(/[&()\s]/g, '')).filter(s => s !== '')
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
  return joinStatements(lines).flatMap(({ text, line }) => {
    const hits: WriteHit[] = []
    const bare = self ? BARE_WRITE.exec(text) : null
    if (self && bare) {
      const call = bare[1] ?? ''
      const found = writeKind(call, '', argumentsAt(text, bare[0].length))
      if (found) {
        hits.push({ table: self.table, call, kind: found, grade: 'constant', line })
      }
    }
    for (const m of text.matchAll(WRITE_CALL)) {
      const call = m[1] ?? ''
      const at = m.index ?? 0
      const receiver = text.slice(0, at)
      const found = writeKind(call, receiver, argumentsAt(text, at + m[0].length))
      const target = found ? receiverOf(receiver, self, ctx) : null
      if (found && target) {
        hits.push({ table: target.table, call, kind: found, grade: target.grade, line })
      }
    }
    return hits
  })
}

export function sqlWritesIn(lines: SourceLine[], tables: Set<string>): WriteHit[] {
  const text = lines.map(l => l.text).join('\n')
  const upsert = UPSERT.test(text)
  const forms: Array<{ re: RegExp; call: string; found: WriteKind }> = [
    { re: SQL_INSERT, call: 'SQL INSERT INTO', found: upsert ? kind('none', 'create', 'update') : kind('none', 'create') },
    { re: SQL_UPDATE, call: 'SQL UPDATE', found: kind('none', 'update') },
    { re: SQL_DELETE, call: 'SQL DELETE FROM', found: kind('none', 'destroy') },
  ]
  return forms.flatMap(({ re, call, found }) => [...text.matchAll(re)].flatMap(m => {
    const table = m[1] ?? ''
    const row = lines[text.slice(0, m.index ?? 0).split('\n').length - 1]
    if (!tables.has(table) || row === undefined) {
      return []
    }
    return [{ table, call, kind: found, grade: 'constant', line: row.line }]
  }))
}
