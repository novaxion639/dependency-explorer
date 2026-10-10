import type { ListenerEffect } from '@dependency-explorer/schema'
import { associationMap, parseAssociations, type Read } from '../code-wiring'
import { reachable, type RepoGraph } from '../code-grades'
import { tableId } from '../resource-registry'
import type { ModelEntry, SpanAt } from './rails-model-index'
import { methodSpans, resolveConstant } from './ruby-source'
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
const SERVICE_ENTRY = new RegExp(`\\b${CONSTANT}\\.new\\b[^\\n]*?\\.(run!?|call|perform)\\b`, 'g')
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
