import type { Listener, ListenerEffect, ListenerPhase, ListenerSurface, Runs, WriteEvent } from '@dependency-explorer/schema'

export type ChainGrade = 'graph' | 'constant' | 'text'
export interface CascadeHop { effect: ListenerEffect; table: string; mode: 'sync' | 'async'; grade: ChainGrade; skipped: number; cycle: boolean; next: CascadeNode[] }
export interface CascadeNode { listener: Listener; hops: CascadeHop[] }
export interface AlsoChange { table: string; via: string[]; mode: 'sync' | 'async'; grade: ChainGrade }
export type ListenerTables = Pick<ListenerSurface, 'listeners' | 'writeSites'>

export const WRITE_EVENTS: readonly WriteEvent[] = ['create', 'update', 'destroy']
const RANK: Record<ListenerPhase, readonly [number, number]> = { validation: [0, 1], save: [2, 5], event: [3, 4], touch: [6, 6], commit: [7, 7], rollback: [8, 8] }
const REVERSED = new Set<ListenerPhase>(['commit', 'rollback'])
const GRADE_ORDER: readonly ChainGrade[] = ['text', 'constant', 'graph']

function rank(l: Listener): number {
  const [before, after] = RANK[l.phase]
  return l.hook.startsWith('before_') || l.kind === 'cascade' ? before : after
}

export function inRailsOrder(listeners: Listener[]): Listener[] {
  return listeners
    .map((l, i) => ({ l, i }))
    .sort((a, b) => rank(a.l) - rank(b.l) || (REVERSED.has(a.l.phase) ? b.i - a.i : a.i - b.i))
    .map(x => x.l)
}

export function listenersRun(write: { events?: WriteEvent[]; runs?: Runs; fires?: string[] }, candidates: Listener[]): Listener[] {
  const events = write.events ?? []
  const onEvent = (l: Listener) => l.events.some(e => events.includes(e))
  if (write.runs === 'all') {
    return candidates.filter(onEvent)
  }
  if (write.runs === 'validation') {
    return candidates.filter(l => l.phase === 'validation' && onEvent(l))
  }
  if (write.runs === 'touch') {
    return candidates.filter(l => l.phase === 'touch' || l.kind === 'touch' || ((l.phase === 'commit' || l.phase === 'rollback') && l.events.includes('update')))
  }
  if (write.runs === 'subset') {
    const fires = new Set(write.fires ?? [])
    return candidates.filter(l => fires.has(l.id))
  }
  return []
}

function weakest(a: ChainGrade, b: ChainGrade): ChainGrade {
  return GRADE_ORDER.indexOf(a) <= GRADE_ORDER.indexOf(b) ? a : b
}

export function listenersByTable(surface: ListenerTables): Map<string, Listener[]> {
  const out = new Map<string, Listener[]>()
  for (const l of surface.listeners) {
    out.set(l.table, [...(out.get(l.table) ?? []), l])
  }
  return out
}

export function cascadeOf(surface: ListenerTables, start: Listener[], origin: string[]): CascadeNode[] {
  const tables = listenersByTable(surface)
  const expand = (listeners: Listener[], path: Set<string>, async: boolean, grade: ChainGrade): CascadeNode[] =>
    listeners.map(listener => ({ listener, hops: listener.effects.filter(e => e.kind === 'writes').map(effect => hop(effect, path, async, grade)) }))
  const hop = (effect: ListenerEffect, path: Set<string>, async: boolean, grade: ChainGrade): CascadeHop => {
    const candidates = tables.get(effect.target) ?? []
    const nextAsync = async || effect.mode === 'async-job'
    const mode: CascadeHop['mode'] = nextAsync ? 'async' : 'sync'
    const nextGrade = weakest(grade, effect.grade)
    const events = effect.events ?? []
    const keys = events.map(e => `${effect.target}|${e}`)
    if (effect.runs === undefined || effect.runs === 'none') {
      return { effect, table: effect.target, mode, grade: nextGrade, skipped: candidates.filter(l => l.events.some(e => events.includes(e))).length, cycle: false, next: [] }
    }
    if (keys.some(k => path.has(k))) {
      return { effect, table: effect.target, mode, grade: nextGrade, skipped: 0, cycle: true, next: [] }
    }
    return { effect, table: effect.target, mode, grade: nextGrade, skipped: 0, cycle: false, next: expand(inRailsOrder(listenersRun(effect, candidates)), new Set([...path, ...keys]), nextAsync, nextGrade) }
  }
  return expand(inRailsOrder(start), new Set(origin), false, 'graph')
}

export function cascadeFrom(surface: ListenerTables, table: string, event: WriteEvent): CascadeNode[] {
  const start = (listenersByTable(surface).get(table) ?? []).filter(l => l.events.includes(event))
  return cascadeOf(surface, start, [`${table}|${event}`])
}

export function flattenCascade(nodes: CascadeNode[], origin: string): AlsoChange[] {
  const best = new Map<string, AlsoChange>()
  const walk = (list: CascadeNode[], via: string[]) => {
    for (const node of list) {
      for (const h of node.hops) {
        const path = [...via, node.listener.id]
        const seen = best.get(h.table)
        if (h.table !== origin && (seen === undefined || seen.via.length > path.length)) {
          best.set(h.table, { table: h.table, via: path, mode: h.mode, grade: h.grade })
        }
        walk(h.next, path)
      }
    }
  }
  walk(nodes, [])
  return [...best.values()].sort((a, b) => a.via.length - b.via.length || a.table.localeCompare(b.table))
}

export function alsoChanges(surface: ListenerTables, table: string): AlsoChange[] {
  return flattenCascade(WRITE_EVENTS.flatMap(e => cascadeFrom(surface, table, e)), table)
}
