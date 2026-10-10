import type { Listener, ListenerEffect, ListenerPhase, Runs, WriteEvent, WriteSite } from '@dependency-explorer/schema'
import { associationMap, escapeRegExp, parseAssociations, stripComments, type Read } from '../code-wiring'
import { reachable, type RepoGraph } from '../code-grades'
import { tableId } from '../resource-registry'
import { buildModelIndex, declarationsOf, type DeclarationAt, type ModelEntry, type SpanAt } from './rails-model-index'
import type { RailsModel } from './rails-schema'
import { blockEnd, classify, methodSpans, resolveConstant, rubyCode } from './ruby-source'
import { joinStatements, linesOf, receiverOf, sqlWritesIn, writesIn, type WriteResolver } from './rails-writes'

export type ListenerFindingKind = 'surface-drift' | 'unresolved-callback' | 'unresolved-job' | 'unknown-gem-macro' | 'cdc-unknown-table' | 'flow-listener-missing' | 'flow-listener-unsupported'
export interface ListenerFinding { kind: ListenerFindingKind; subject: string; detail: string }
export interface ListenerContext extends WriteResolver {
  read: Read
  graph: RepoGraph | null
  tables: Set<string>
  byClass: Map<string, ModelEntry>
  findings: ListenerFinding[]
}
type EffectMode = ListenerEffect['mode']
interface Callee { constant: string; method?: string; file: string | null; span: SpanAt | null; model: ModelEntry | null; async: boolean }

export const JOB_ROOTS = ['app/jobs', 'app/workers', 'lib']
export const SERVICE_ROOTS = ['app/services', 'app/models/concerns', 'app/models', 'lib']
const CONSTANT = '((?:[A-Z]\\w*::)*[A-Z]\\w*)'
const ENQUEUE = new RegExp(`\\b${CONSTANT}(?:\\.set\\([^)]*\\))?\\.(perform_later|perform_async|perform_in|perform_at)\\b`, 'g')
const DELAYED = new RegExp(`\\b${CONSTANT}\\.delay(?:\\([^)]*\\))?\\.(\\w+[!?]?)`, 'g')
const SERVICE_ENTRY = new RegExp(`\\b${CONSTANT}\\.new\\b[^\\n]*?\\.(run!?|call|perform)(?![\\w])`, 'g')
const CLASS_CALL = new RegExp(`\\b${CONSTANT}\\.([a-z_]\\w*[!?]?)`, 'g')
const SKIPPED_METHODS = new Set(['new', 'delay', 'set', 'perform_later', 'perform_async', 'perform_in', 'perform_at', 'perform_now'])

export function listenerContext(entries: ModelEntry[], read: Read, graph: RepoGraph | null, tables: string[]): ListenerContext {
  return {
    read,
    graph,
    tables: new Set(tables),
    byClass: new Map(entries.map(e => [e.className, e])),
    classes: new Set(entries.map(e => e.className)),
    associations: associationMap(entries.flatMap(e => parseAssociations(read(e.file) ?? ''))),
    findings: [],
  }
}

function graded(ctx: ListenerContext, from: string, to: string | null): 'graph' | 'constant' {
  return to !== null && ctx.graph !== null && reachable(ctx.graph.fileEdges, from, to) ? 'graph' : 'constant'
}

function spanIn(file: string | null, name: string, ctx: ListenerContext): SpanAt | null {
  const source = file === null ? null : ctx.read(file)
  const span = source === null ? undefined : methodSpans(source).find(s => s.name === name)
  return span !== undefined && file !== null ? { ...span, file } : null
}

function calleesOn(text: string, ctx: ListenerContext): Callee[] {
  const out: Callee[] = []
  for (const m of text.matchAll(SERVICE_ENTRY)) {
    const constant = m[1] ?? ''
    const file = ctx.byClass.has(constant) ? null : resolveConstant(constant, SERVICE_ROOTS, ctx.read)
    if (file !== null) {
      out.push({ constant, file, span: spanIn(file, m[2] ?? '', ctx), model: null, async: false })
    }
  }
  for (const m of text.matchAll(DELAYED)) {
    const constant = m[1] ?? ''
    const method = m[2] ?? ''
    const model = ctx.byClass.get(constant) ?? null
    const file = model ? model.file : resolveConstant(constant, SERVICE_ROOTS, ctx.read)
    const span = model ? model.methods.get(`self.${method}`) ?? null : spanIn(file, `self.${method}`, ctx)
    if (file !== null) {
      out.push({ constant, method, file, span, model, async: true })
    }
  }
  for (const m of text.matchAll(CLASS_CALL)) {
    const constant = m[1] ?? ''
    const method = m[2] ?? ''
    if (SKIPPED_METHODS.has(method)) {
      continue
    }
    const model = ctx.byClass.get(constant)
    const modelSpan = model ? model.methods.get(`self.${method}`) : undefined
    if (model && modelSpan) {
      out.push({ constant, method, file: modelSpan.file, span: modelSpan, model, async: false })
      continue
    }
    const file = model ? null : resolveConstant(constant, SERVICE_ROOTS, ctx.read)
    if (file !== null) {
      out.push({ constant, method, file, span: spanIn(file, `self.${method}`, ctx), model: null, async: false })
    }
  }
  return out
}

function writeEffects(span: SpanAt, self: ModelEntry | null, ctx: ListenerContext, mode: EffectMode, via: string | undefined): ListenerEffect[] {
  const hits = [...writesIn(linesOf(span.body, span.line), self, ctx), ...sqlWritesIn(linesOf(span.raw, span.line), ctx.tables)]
  return hits.map(hit => ({ kind: 'writes', target: tableId(hit.table), mode, ...(via ? { via } : {}), events: hit.kind.events, runs: hit.kind.runs, at: { file: span.file, line: hit.line }, grade: hit.grade }))
}

function callEffects(span: SpanAt, ctx: ListenerContext, mode: EffectMode, via: string | undefined): ListenerEffect[] {
  return linesOf(span.body, span.line).flatMap(({ text, line }) => calleesOn(text, ctx).flatMap(callee => {
    const target = callee.method ? `${callee.constant}.${callee.method}` : callee.constant
    const callMode: EffectMode = callee.async ? 'async-job' : mode
    const call: ListenerEffect = { kind: 'calls', target, ...(callee.file ? { targetFile: callee.file } : {}), mode: callMode, ...(via ? { via } : {}), at: { file: span.file, line }, grade: graded(ctx, span.file, callee.file) }
    const chain = via ? `${via} → ${target}` : target
    return [call, ...(callee.span ? writeEffects(callee.span, callee.model, ctx, callMode, chain) : [])]
  }))
}

function enqueueEffects(span: SpanAt, ctx: ListenerContext): ListenerEffect[] {
  return linesOf(span.body, span.line).flatMap(({ text, line }) => [...text.matchAll(ENQUEUE)].flatMap(m => {
    const job = m[1] ?? ''
    const jobFile = resolveConstant(job, JOB_ROOTS, ctx.read)
    const at = { file: span.file, line }
    if (jobFile === null) {
      ctx.findings.push({ kind: 'unresolved-job', subject: job, detail: `enqueued at ${span.file}:${line}; no file under ${JOB_ROOTS.join(', ')}` })
      const unresolved: ListenerEffect = { kind: 'enqueues', target: job, mode: 'async-job', at, grade: 'constant' }
      return [unresolved]
    }
    const enqueue: ListenerEffect = { kind: 'enqueues', target: job, targetFile: jobFile, mode: 'async-job', at, grade: graded(ctx, span.file, jobFile) }
    const perform = spanIn(jobFile, 'perform', ctx)
    return [enqueue, ...(perform ? [...callEffects(perform, ctx, 'async-job', job), ...writeEffects(perform, null, ctx, 'async-job', job)] : [])]
  }))
}

function dedupeEffects(effects: ListenerEffect[]): ListenerEffect[] {
  const seen = new Set<string>()
  return effects.filter(e => {
    const key = [e.kind, e.target, e.via ?? '', e.at.file, e.at.line, (e.events ?? []).join(',')].join('|')
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

export function effectsOf(span: SpanAt, self: ModelEntry | null, ctx: ListenerContext): ListenerEffect[] {
  return dedupeEffects([...enqueueEffects(span, ctx), ...callEffects(span, ctx, 'sync', undefined), ...writeEffects(span, self, ctx, 'sync', undefined)])
}

const CALLBACK_START = /^\s*(?:before|after|around)_(?:validation|save|create|update|destroy|commit|rollback|touch)\b/
const CALLBACK = /^\s*((?:before|after|around)_(validation|save|create|update|destroy|commit|rollback|touch))\b([\s\S]*)$/
const SYMBOL = /^:(\w+[!?]?)$/
const OPTION = /^(on|if|unless|prepend):\s*([\s\S]+)$/
const EVENTS: readonly WriteEvent[] = ['create', 'update', 'destroy']
const PHASE: Record<string, ListenerPhase> = { validation: 'validation', save: 'save', create: 'event', update: 'event', destroy: 'event', commit: 'commit', rollback: 'rollback', touch: 'touch' }

function splitArgs(rest: string): string[] {
  const out: string[] = []
  let depth = 0
  let current = ''
  for (const ch of rest) {
    if (ch === '(' || ch === '[' || ch === '{') {
      depth += 1
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth -= 1
    }
    if (ch === ',' && depth === 0) {
      out.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  return [...out, current.trim()].filter(a => a !== '')
}

function eventsOf(phaseWord: string, on: string | undefined): WriteEvent[] {
  const named = EVENTS.filter(e => e === phaseWord)
  if (named.length) {
    return named
  }
  if (phaseWord === 'touch') {
    return ['update']
  }
  const listed = on === undefined ? [] : EVENTS.filter(e => new RegExp(`\\b${e}\\b`).test(on))
  if (listed.length) {
    return listed
  }
  return phaseWord === 'commit' || phaseWord === 'rollback' ? [...EVENTS] : ['create', 'update']
}

function blockSpan(decl: DeclarationAt, ctx: ListenerContext): SpanAt {
  const source = ctx.read(decl.file) ?? ''
  const code = rubyCode(source).split('\n')
  const raw = stripComments(source).split('\n')
  const end = blockEnd(code, decl.line - 1)
  return {
    name: 'block',
    line: decl.line,
    body: code.slice(decl.line - 1, end + 1).join('\n'),
    raw: raw.slice(decl.line - 1, end + 1).join('\n'),
    file: decl.file,
  }
}

export const GEM_CALLBACK_METHODS: Record<string, string[]> = { geocoded_by: ['geocode'], reverse_geocoded_by: ['reverse_geocode'] }
const GEM_CALLBACK_MACRO = new RegExp(`^\\s*(${Object.keys(GEM_CALLBACK_METHODS).join('|')})\\b`)

function gemProvidedMethods(entry: ModelEntry): Set<string> {
  return new Set(declarationsOf(entry, GEM_CALLBACK_MACRO).flatMap(decl => GEM_CALLBACK_METHODS[GEM_CALLBACK_MACRO.exec(decl.text)?.[1] ?? ''] ?? []))
}

export function callbackListeners(entry: ModelEntry, ctx: ListenerContext): Listener[] {
  const gemProvided = gemProvidedMethods(entry)
  return declarationsOf(entry, CALLBACK_START).flatMap(decl => {
    const m = CALLBACK.exec(decl.text)
    if (!m) {
      return []
    }
    const hook = m[1] ?? ''
    const args = splitArgs(m[3] ?? '')
    const options = new Map(args.flatMap(a => {
      const o = OPTION.exec(a)
      return o ? [[o[1] ?? '', (o[2] ?? '').trim()] as const] : []
    }))
    const condition = ['if', 'unless'].flatMap(k => (options.has(k) ? [`${k}: ${options.get(k) ?? ''}`] : [])).join(', ')
    const base = {
      table: tableId(entry.table),
      kind: 'callback' as const,
      hook,
      events: eventsOf(m[2] ?? '', options.get('on')),
      phase: PHASE[m[2] ?? ''] ?? 'event',
      ...(condition ? { condition } : {}),
      declaredAt: { file: decl.file, line: decl.line },
      grade: 'code' as const,
    }
    const symbols = args.flatMap(a => SYMBOL.exec(a)?.[1] ?? [])
    const bodies = args.filter(a => !SYMBOL.test(a) && !OPTION.test(a))
    const bySymbol = symbols.map((method): Listener => {
      const span = entry.methods.get(method)
      if (!span && !gemProvided.has(method)) {
        ctx.findings.push({ kind: 'unresolved-callback', subject: `${entry.className}#${method}`, detail: `${decl.file}:${decl.line} names a method neither ${entry.className} nor its included modules define` })
      }
      return { ...base, id: `${entry.table}.${hook}.${method}`, method, ...(span ? { definedAt: { file: span.file, line: span.line } } : {}), effects: span ? effectsOf(span, entry, ctx) : [] }
    })
    const byBody = bodies.map((body): Listener => {
      const span = /\bdo\b/.test(body) ? blockSpan(decl, ctx) : { name: 'block', line: decl.line, body, raw: body, file: decl.file }
      return { ...base, id: `${entry.table}.${hook}.block@${decl.line}`, effects: effectsOf(span, entry, ctx) }
    })
    return [...bySymbol, ...byBody]
  })
}

const ASSOCIATION_START = /^\s*(?:has_many|has_one|has_and_belongs_to_many|belongs_to)\s+:/
const ASSOCIATION = /^\s*(has_many|has_one|has_and_belongs_to_many|belongs_to)\s+:(\w+)([\s\S]*)$/
const DEPENDENT = /dependent:\s*:(destroy|delete_all|delete|nullify)\b/
const CLASS_NAME = /class_name:\s*['"](?:\w+::)*(\w+)['"]/
const JOIN_TABLE = /join_table:\s*['":]+(\w+)/
const TOUCH = /\btouch:\s*true\b/
const GEM_START = /^\s*(?:acts_as_\w+|has_\w+|multisearchable)\b(?!\s*(?:[-+*/|&]?=|\.|\)))/
const GEM = /^\s*(acts_as_\w+|has_\w+|multisearchable)\b([\s\S]*)$/
const ORPHAN_STRATEGY = /orphan_strategy:\s*:(\w+)/
const RAILS_ASSOCIATIONS = new Set(['has_many', 'has_one', 'has_and_belongs_to_many'])

interface GemEffect { table: string | null; events: WriteEvent[]; runs: Runs }
interface GemListener { events: WriteEvent[]; phase: ListenerPhase; effects: GemEffect[] }

export const KNOWN_GEM_LISTENERS: Record<string, GemListener | null> = {
  acts_as_list: { events: ['create', 'update', 'destroy'], phase: 'event', effects: [{ table: null, events: ['update'], runs: 'none' }] },
  has_ancestry: { events: ['update', 'destroy'], phase: 'event', effects: [{ table: null, events: ['update'], runs: 'all' }] },
  multisearchable: {
    events: ['create', 'update', 'destroy'],
    phase: 'event',
    effects: [
      { table: 'pg_search_documents', events: ['create', 'update'], runs: 'all' },
      { table: 'pg_search_documents', events: ['destroy'], runs: 'none' },
    ],
  },
  has_secure_token: { events: ['create'], phase: 'event', effects: [] },
  has_encrypted: null,
  has_secure_password: null,
  has_one_attached: null,
  has_many_attached: null,
  has_rich_text: null,
}

function tableOfClass(cls: string, ctx: ListenerContext): string | null {
  return ctx.byClass.get(cls)?.table ?? null
}

export function joinTableName(a: string, b: string): string {
  return [a, b].sort().join('\0').replace(/^(.*_)(.+)\0\1(.+)/, '$1$2_$3').replace(/\0/g, '_')
}

export function associationListeners(entry: ModelEntry, ctx: ListenerContext): Listener[] {
  return declarationsOf(entry, ASSOCIATION_START).flatMap((decl): Listener[] => {
    const m = ASSOCIATION.exec(decl.text)
    if (!m) {
      return []
    }
    const macro = m[1] ?? ''
    const name = m[2] ?? ''
    const rest = m[3] ?? ''
    const other = tableOfClass(CLASS_NAME.exec(rest)?.[1] ?? classify(name), ctx)
    const at = { file: decl.file, line: decl.line }
    const own = tableId(entry.table)
    if (macro === 'belongs_to') {
      if (!TOUCH.test(rest) || other === null || !ctx.tables.has(other)) {
        return []
      }
      return [{
        id: `${entry.table}.touch.${name}`,
        table: own,
        kind: 'touch',
        hook: 'touch: true',
        events: ['create', 'update', 'destroy'],
        phase: 'commit',
        declaredAt: at,
        grade: 'code',
        effects: [{ kind: 'writes', target: tableId(other), mode: 'sync', events: ['update'], runs: 'touch', at, grade: 'constant' }],
      }]
    }
    if (macro === 'has_and_belongs_to_many') {
      const join = JOIN_TABLE.exec(rest)?.[1] ?? (other === null ? null : joinTableName(entry.table, other))
      if (join === null || !ctx.tables.has(join)) {
        return []
      }
      return [{
        id: `${entry.table}.habtm.${name}`,
        table: own,
        kind: 'cascade',
        hook: 'has_and_belongs_to_many',
        events: ['destroy'],
        phase: 'event',
        declaredAt: at,
        grade: 'code',
        effects: [{ kind: 'writes', target: tableId(join), mode: 'sync', events: ['destroy'], runs: 'none', at, grade: 'constant' }],
      }]
    }
    const dependent = DEPENDENT.exec(rest)?.[1]
    if (dependent === undefined || other === null || !ctx.tables.has(other)) {
      return []
    }
    return [{
      id: `${entry.table}.dependent.${name}`,
      table: own,
      kind: 'cascade',
      hook: `dependent: :${dependent}`,
      events: ['destroy'],
      phase: 'event',
      declaredAt: at,
      grade: 'code',
      effects: [{
        kind: 'writes',
        target: tableId(other),
        mode: 'sync',
        events: dependent === 'nullify' ? ['update'] : ['destroy'],
        runs: dependent === 'destroy' ? 'all' : 'none',
        at,
        grade: 'constant',
      }],
    }]
  })
}

function insideMethod(entry: ModelEntry, decl: DeclarationAt): boolean {
  return [...entry.methods.values()].some(s => s.file === decl.file && decl.line > s.line && decl.line < s.line + s.body.split('\n').length - 1)
}

export function gemListeners(entry: ModelEntry, ctx: ListenerContext): Listener[] {
  return declarationsOf(entry, GEM_START).filter(decl => !insideMethod(entry, decl)).flatMap((decl): Listener[] => {
    const m = GEM.exec(decl.text)
    const macro = m?.[1] ?? ''
    if (!m || RAILS_ASSOCIATIONS.has(macro)) {
      return []
    }
    if (!(macro in KNOWN_GEM_LISTENERS)) {
      ctx.findings.push({ kind: 'unknown-gem-macro', subject: `${entry.className}.${macro}`, detail: `${decl.file}:${decl.line} — not a Rails association and not in KNOWN_GEM_LISTENERS` })
      return []
    }
    const known = KNOWN_GEM_LISTENERS[macro]
    if (known === null) {
      return []
    }
    const at = { file: decl.file, line: decl.line }
    const orphanStrategy = ORPHAN_STRATEGY.exec(m[2] ?? '')?.[1] ?? 'destroy'
    const extra: GemEffect[] = macro === 'has_ancestry' && orphanStrategy === 'destroy' ? [{ table: null, events: ['destroy'], runs: 'all' }] : []
    const effects = [...known.effects, ...extra].flatMap((g): ListenerEffect[] => {
      const table = g.table ?? entry.table
      if (!ctx.tables.has(table)) {
        return []
      }
      return [{ kind: 'writes', target: tableId(table), mode: 'sync', events: g.events, runs: g.runs, at, grade: 'constant' }]
    })
    return [{ id: `${entry.table}.${macro}`, table: tableId(entry.table), kind: 'gem', hook: macro, events: known.events, phase: known.phase, declaredAt: at, effects, grade: 'config' }]
  })
}

const RUN_CALLBACKS = /\brun_callbacks\(\s*:(\w+)/
const BARE_CALL = /^\s*(\w+[!?]?)\s*$/
const PHASE_OF_CHAIN: Record<string, (l: Listener) => boolean> = {
  commit: l => l.phase === 'commit',
  rollback: l => l.phase === 'rollback',
  save: l => l.phase === 'save',
  validation: l => l.phase === 'validation',
  touch: l => l.phase === 'touch',
  create: l => l.phase === 'event' && l.hook.endsWith('_create'),
  update: l => l.phase === 'event' && l.hook.endsWith('_update'),
  destroy: l => l.phase === 'event' && l.hook.endsWith('_destroy'),
}
const FIRED_EVENTS: WriteEvent[] = ['create', 'update', 'destroy']

interface SourceFile { file: string; source: string }
interface Helper { name: string; entry: ModelEntry; fires: string[]; file: string; from: number; to: number }

function chainListeners(chain: string, own: Listener[]): Listener[] {
  return Object.hasOwn(PHASE_OF_CHAIN, chain) ? own.filter(PHASE_OF_CHAIN[chain]) : []
}

function callbackListenersOf(entry: ModelEntry, listeners: Listener[]): Listener[] {
  return listeners.filter(l => l.table === tableId(entry.table) && l.kind === 'callback')
}

function helpersOf(entries: ModelEntry[], listeners: Listener[]): Helper[] {
  return entries.flatMap(entry => {
    const own = callbackListenersOf(entry, listeners)
    return [...entry.methods.values()].flatMap(span => {
      const bodyLines = span.body.split('\n')
      const inner = bodyLines.slice(1, -1).map(l => l.trim()).filter(l => l !== '')
      const fired = inner.map(line => {
        const chain = RUN_CALLBACKS.exec(line)?.[1]
        const bare = BARE_CALL.exec(line)?.[1]
        return chain !== undefined ? chainListeners(chain, own) : own.filter(l => l.method !== undefined && l.method === bare)
      })
      if (span.name.startsWith('self.') || inner.length === 0 || fired.some(f => f.length === 0)) {
        return []
      }
      const fires = [...new Set(fired.flat().map(l => l.id))]
      return [{ name: span.name, entry, fires, file: span.file, from: span.line, to: span.line + bodyLines.length - 1 }]
    })
  })
}

function selfByFile(entries: ModelEntry[]): Map<string, ModelEntry> {
  const hosts = new Map<string, ModelEntry[]>()
  for (const entry of entries) {
    for (const file of [entry.file, ...entry.modules]) {
      hosts.set(file, [...(hosts.get(file) ?? []), entry])
    }
  }
  return new Map([...hosts].flatMap(([file, list]) => (list.length === 1 && list[0] ? [[file, list[0]] as const] : [])))
}

function firedSites(file: string, lines: ReturnType<typeof linesOf>, self: ModelEntry | null, listeners: Listener[], entries: ModelEntry[], helpers: Helper[], ctx: ListenerContext): WriteSite[] {
  const inHelper = (line: number) => helpers.some(h => h.file === file && line >= h.from && line <= h.to)
  return joinStatements(lines).flatMap(({ text, line }) => {
    if (inHelper(line)) {
      return []
    }
    const out: WriteSite[] = []
    for (const name of new Set(helpers.map(h => h.name))) {
      const call = new RegExp(`(?:\\.|&:)${escapeRegExp(name)}(?![\\w!?])`).exec(text)
      if (!call) {
        continue
      }
      const candidates = helpers.filter(h => h.name === name)
      const receiver = receiverOf(text.slice(0, call.index), self, ctx)
      const owner = candidates.find(h => receiver !== null && tableId(h.entry.table) === tableId(receiver.table)) ?? (receiver === null && candidates.length === 1 ? candidates[0] : undefined)
      if (owner) {
        out.push({ table: tableId(owner.entry.table), file, line, call: name, events: FIRED_EVENTS, runs: 'subset', fires: owner.fires, grade: receiver !== null && receiver.grade === 'constant' ? 'constant' : 'text' })
      }
    }
    const chain = RUN_CALLBACKS.exec(text)
    if (chain) {
      const receiver = receiverOf(text.slice(0, Math.max(0, text.indexOf('run_callbacks') - 1)), self, ctx)
      const model = receiver ? entries.find(e => e.table === receiver.table) : undefined
      if (receiver && model) {
        const phase = chain[1] ?? ''
        out.push({ table: tableId(model.table), file, line, call: `run_callbacks(:${phase})`, events: FIRED_EVENTS, runs: 'subset', fires: chainListeners(phase, callbackListenersOf(model, listeners)).map(l => l.id), grade: receiver.grade })
      }
    }
    return out
  })
}

export function writeSites(files: SourceFile[], listeners: Listener[], entries: ModelEntry[], ctx: ListenerContext): WriteSite[] {
  const selfOf = selfByFile(entries)
  const helpers = helpersOf(entries, listeners)
  return files.flatMap(({ file, source }) => {
    const self = selfOf.get(file) ?? null
    const lines = linesOf(rubyCode(source), 1)
    const direct = [...writesIn(lines, self, ctx), ...sqlWritesIn(linesOf(stripComments(source), 1), ctx.tables)].map((hit): WriteSite => ({
      table: tableId(hit.table),
      file,
      line: hit.line,
      call: hit.call,
      events: hit.kind.events,
      runs: hit.kind.runs,
      grade: hit.grade,
    }))
    return [...direct, ...firedSites(file, lines, self, listeners, entries, helpers, ctx)]
  })
}

function memo(read: Read): Read {
  const cache = new Map<string, string | null>()
  return p => {
    if (!cache.has(p)) {
      cache.set(p, read(p))
    }
    return cache.get(p) ?? null
  }
}

function uniqueIds(listeners: Listener[]): Listener[] {
  const seen = new Set<string>()
  return listeners.map(listener => {
    if (!seen.has(listener.id)) {
      seen.add(listener.id)
      return listener
    }
    const basename = listener.declaredAt.file.split('/').pop() ?? listener.declaredAt.file
    const located = `${listener.id}@${basename}:${listener.declaredAt.line}`
    let id = located
    for (let n = 2; seen.has(id); n++) {
      id = `${located}#${n}`
    }
    seen.add(id)
    return { ...listener, id }
  })
}

function uniqueFindings(findings: ListenerFinding[]): ListenerFinding[] {
  const seen = new Set<string>()
  return findings.filter(f => {
    const key = `${f.kind}|${f.subject}|${f.detail}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

export function extractListeners(input: { models: RailsModel[]; tables: string[]; files: SourceFile[]; read: Read; graph: RepoGraph | null }): { listeners: Listener[]; writeSites: WriteSite[]; findings: ListenerFinding[] } {
  const read = memo(input.read)
  const entries = buildModelIndex(input.models, read)
  const ctx = listenerContext(entries, read, input.graph, input.tables)
  const listeners = uniqueIds(entries.flatMap(entry => [...callbackListeners(entry, ctx), ...associationListeners(entry, ctx), ...gemListeners(entry, ctx)]))
  const scanned = input.files.filter(f => /^(app|lib)\//.test(f.file) && !/(^|\/)(spec|test)\//.test(f.file))
  return { listeners, writeSites: writeSites(scanned, listeners, entries, ctx), findings: uniqueFindings(ctx.findings) }
}
