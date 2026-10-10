import type { Listener, ListenerEffect, ListenerPhase, WriteEvent } from '@dependency-explorer/schema'
import { associationMap, parseAssociations, stripComments, type Read } from '../code-wiring'
import { reachable, type RepoGraph } from '../code-grades'
import { tableId } from '../resource-registry'
import { declarationsOf, type DeclarationAt, type ModelEntry, type SpanAt } from './rails-model-index'
import { blockEnd, methodSpans, resolveConstant, rubyCode } from './ruby-source'
import { linesOf, sqlWritesIn, writesIn, type WriteResolver } from './rails-writes'

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

export function callbackListeners(entry: ModelEntry, ctx: ListenerContext): Listener[] {
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
      if (!span) {
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
