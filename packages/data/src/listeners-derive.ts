import type { CrudOperation, Listener, ListenerEffect, ListenerPhase, ListenerSurface, Runs, ServiceFlow, WriteEvent, WriteSite } from '@dependency-explorer/schema'

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
    return candidates.filter(l => l.phase === 'touch' || (l.kind === 'touch' && onEvent(l)) || ((l.phase === 'commit' || l.phase === 'rollback') && l.events.includes('update')))
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
    const events = effect.events ?? WRITE_EVENTS
    if (effect.runs === undefined || effect.runs === 'none') {
      return { effect, table: effect.target, mode, grade: nextGrade, skipped: candidates.filter(l => l.events.some(e => events.includes(e))).length, cycle: false, next: [] }
    }
    const fresh = events.filter(e => !path.has(`${effect.target}|${e}`))
    const freshKeys = fresh.map(e => `${effect.target}|${e}`)
    const next = fresh.length === 0 ? [] : expand(inRailsOrder(listenersRun({ runs: effect.runs, events: fresh }, candidates)), new Set([...path, ...freshKeys]), nextAsync, nextGrade)
    return { effect, table: effect.target, mode, grade: nextGrade, skipped: 0, cycle: fresh.length < events.length, next }
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

export interface FlowListenerLink { unit: string; table: string; site: WriteSite | null; listeners: Listener[]; basis: 'write-site' | 'table-event'; grade: ChainGrade }
export interface ListenerDriftFinding { kind: 'flow-listener-missing' | 'flow-listener-unsupported'; subject: string; detail: string }
export interface TableListenerMetrics { listeners: number; alsoChanges: number; async: number; bypassing: number; onCycle: boolean }

const MONOLITH = 'skello-app'
const CRUD_EVENT: Record<CrudOperation, WriteEvent | null> = { create: 'create', read: null, update: 'update', delete: 'destroy' }

function tableName(id: string): string {
  return id.split('.').pop() ?? id
}

function returnsTo(nodes: CascadeNode[], table: string): boolean {
  return nodes.some(n => n.hops.some(h => (h.cycle && h.table === table) || returnsTo(h.next, table)))
}

export function flowListeners(flow: ServiceFlow, surface: ListenerTables): FlowListenerLink[] {
  const tables = listenersByTable(surface)
  const storeTables = new Map((flow.infraNodes ?? []).filter(n => n.type === 'postgresql').map((n): [string, string[]] => [n.id, n.resources ?? []]))
  const flowTables = new Set([...storeTables.values()].flat())
  return (flow.codeUnits ?? []).filter(u => u.service === MONOLITH && u.path !== undefined && u.kind !== 'model-callback').flatMap((unit): FlowListenerLink[] => {
    const sites = surface.writeSites.filter(s => s.file === unit.path && flowTables.has(s.table))
    const covered = new Set(sites.map(s => s.table))
    const bySite = sites.map((site): FlowListenerLink => ({ unit: unit.id, table: site.table, site, listeners: inRailsOrder(listenersRun(site, tables.get(site.table) ?? [])), basis: 'write-site', grade: site.grade }))
    const byEvent = (flow.codeEdges ?? []).filter(e => e.from === unit.id && storeTables.has(e.to)).flatMap(e => {
      const events = (e.crud ?? []).flatMap(c => CRUD_EVENT[c] ?? [])
      return (storeTables.get(e.to) ?? []).filter(table => !covered.has(table)).flatMap((table): FlowListenerLink[] => {
        const listeners = inRailsOrder((tables.get(table) ?? []).filter(l => l.events.some(ev => events.includes(ev))))
        return listeners.length > 0 ? [{ unit: unit.id, table, site: null, listeners, basis: 'table-event', grade: 'text' }] : []
      })
    })
    return [...bySite, ...byEvent]
  })
}

export function firedListeners(flow: ServiceFlow, surface: ListenerTables): Listener[] {
  const fired = flowListeners(flow, surface).filter(link => link.basis === 'write-site').flatMap(link => link.listeners)
  return [...new Map(fired.map((l): [string, Listener] => [l.id, l])).values()]
}

export function flowListenerDrift(flow: ServiceFlow, surface: ListenerTables): ListenerDriftFinding[] {
  const units = flow.codeUnits ?? []
  const callbackUnits = new Set(units.filter(u => u.kind === 'model-callback').map(u => u.id))
  if (callbackUnits.size === 0) {
    return []
  }
  const drawn = (flow.codeEdges ?? []).filter(e => callbackUnits.has(e.from))
  const drawnJobs = drawn.flatMap((e): Array<{ id: string; path: string }> => {
    const path = units.find(u => u.id === e.to && u.kind === 'job')?.path
    return path === undefined ? [] : [{ id: e.to, path }]
  })
  const drawnStores = drawn.flatMap(e => {
    const node = (flow.infraNodes ?? []).find(n => n.id === e.to && n.type === 'postgresql')
    return node === undefined ? [] : [node]
  })
  const drawnJobPaths = new Set(drawnJobs.map(j => j.path))
  const drawnTables = new Set(drawnStores.flatMap(n => n.resources ?? []))
  const direct = firedListeners(flow, surface).flatMap(listener => listener.effects.filter(e => e.via === undefined).map(effect => ({ listener, effect })))
  const firedJobPaths = new Set(direct.flatMap(({ effect }) => (effect.kind === 'enqueues' && effect.targetFile !== undefined ? [effect.targetFile] : [])))
  const firedTables = new Set(direct.flatMap(({ effect }) => (effect.kind === 'writes' ? [effect.target] : [])))
  const finding = (kind: ListenerDriftFinding['kind'], detail: string): ListenerDriftFinding => ({ kind, subject: flow.id, detail })
  const missing = direct.flatMap(({ listener, effect }): ListenerDriftFinding[] => {
    if (effect.kind === 'enqueues' && effect.targetFile !== undefined && !drawnJobPaths.has(effect.targetFile)) {
      return [finding('flow-listener-missing', `${listener.id} enqueues ${effect.target} — not drawn from a model-callback unit`)]
    }
    if (effect.kind === 'writes' && !drawnTables.has(effect.target)) {
      return [finding('flow-listener-missing', `${listener.id} writes ${tableName(effect.target)} — not drawn from a model-callback unit`)]
    }
    return []
  })
  const unsupportedJobs = drawnJobs.filter(j => !firedJobPaths.has(j.path)).map(j => finding('flow-listener-unsupported', `${j.id} (${j.path}) is drawn from a model-callback unit; no listener the flow fires enqueues it`))
  const unsupportedStores = drawnStores.filter(n => !(n.resources ?? []).some(r => firedTables.has(r))).map(n => finding('flow-listener-unsupported', `${n.id} is drawn from a model-callback unit; no listener the flow fires writes ${(n.resources ?? []).map(tableName).join(', ')}`))
  const findings = [...missing, ...unsupportedJobs, ...unsupportedStores]
  return [...new Map(findings.map((f): [string, ListenerDriftFinding] => [`${f.kind}|${f.detail}`, f])).values()]
}

export function listenerMetrics(surface: ListenerTables): Map<string, TableListenerMetrics> {
  return new Map([...listenersByTable(surface)].map(([table, listeners]): [string, TableListenerMetrics] => [table, {
    listeners: listeners.length,
    alsoChanges: alsoChanges(surface, table).length,
    async: listeners.filter(l => l.effects.some(e => e.mode === 'async-job')).length,
    bypassing: surface.writeSites.filter(s => s.table === table && s.runs === 'none').length,
    onCycle: WRITE_EVENTS.some(e => returnsTo(cascadeFrom(surface, table, e), table)),
  }]))
}
