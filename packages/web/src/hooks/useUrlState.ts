import { useCallback, useEffect, useRef, useState } from 'react'
import type { WriteEvent } from '@dependency-explorer/data'
import type { Renderer } from '../diagram/model'

/**
 * Permalink state — every shareable bit of UI state lives in the query string
 * (never in a path segment: the bundle must work from any static host or
 * SSO proxy without rewrite rules, see ADR-0005).
 *
 *   (no params)                          home (question-first landing)
 *   ?page=areas&area=planning&term=Poste product area page, glossary term highlighted
 *   ?page=microservices                  microservices overview
 *   ?page=microservices&area=planning    overview, area spotlit (also on monolith)
 *   ?page=microservices&s=svc-users      one service
 *   ?page=monolith                       skello-app
 *   ?page=flows&flow=shift-creation      flow page
 *   ?page=flows&flows=svc-users          flows a service takes part in
 *   ?page=flows&file=svc-punch/src/…     flows traversing a file
 *   ?page=flows&flag=FEATUREDEV_X        flows gated by a feature flag
 *   ?page=resources&resource=pg:…        resource page (change impact)
 *   &event=create|update|destroy · &listener=<id> · &lev · &lkind · &lgrade   resource page listener sections
 *   ?page=impact&blast=svc-users         impact of a failing service or resource
 *   ?page=ownership&team=team-salsa      ownership, team focused
 *   &edge=from~to~protocol[,…] · &drawer=svc · &ep=id   detail panel content
 *   &unit=<unit or store id> · &chapter=<n>   flow page panel · story step
 *   &present=1                           present mode
 *   &renderer=svg | mermaid              diagram renderer (React Flow by default)
 *
 * Legacy keys (`view=…`, a bare `s`, `flow`, `blast=1&s=…`) parse into the page form.
 */
export type Page = 'home' | 'areas' | 'microservices' | 'monolith' | 'flows' | 'resources' | 'impact' | 'ownership'

export const PAGES: readonly Page[] = ['home', 'areas', 'microservices', 'monolith', 'flows', 'resources', 'impact', 'ownership']
const RENDERERS: readonly Renderer[] = ['react-flow', 'svg', 'mermaid']
const WRITE_EVENT_PARAMS: readonly WriteEvent[] = ['create', 'update', 'destroy']
const MONOLITH = 'skello-app'
const LEGACY_VIEW_PAGE: Record<string, Page> = { areas: 'areas', domains: 'areas', context: 'microservices', services: 'microservices', resources: 'resources', teams: 'ownership' }

export interface UrlState {
  s: string | null
  page: Page
  present: boolean
  renderer: Renderer
  area: string | null
  term: string | null
  team: string | null
  blast: string | null
  flows: string | null
  flow: string | null
  unit: string | null
  chapter: number | null
  edge: string | null
  drawer: string | null
  ep: string | null
  flag: string | null
  file: string | null
  resource: string | null
  event: WriteEvent | null
  listener: string | null
  lev: string | null
  lkind: string | null
  lgrade: string | null
  /** A permalink param that did not resolve — rendered as a banner, never serialized */
  notFound: { param: 'area' | 'term' | 'flow' | 's' | 'resource' | 'blast'; value: string } | null
}

export const EDGE_SEP = '~'
export const EDGE_LIST_SEP = ','

const NAVIGATION_KEYS = ['page', 'area', 's', 'team', 'flows', 'flow', 'edge', 'drawer', 'flag', 'file', 'resource', 'blast'] as const

export function edgeKey(from: string, to: string, protocol: string): string {
  return [from, to, protocol].join(EDGE_SEP)
}

export function servicePage(name: string): Page {
  return name === MONOLITH ? 'monolith' : 'microservices'
}

function inferPage(p: URLSearchParams): Page {
  if (p.get('flow') || p.get('flows') || p.get('file') || p.get('flag')) {
    return 'flows'
  }
  if (p.get('resource')) {
    return 'resources'
  }
  if (p.get('blast')) {
    return 'impact'
  }
  const view = LEGACY_VIEW_PAGE[p.get('view') ?? '']
  if (view) {
    return view
  }
  const s = p.get('s')
  return s ? servicePage(s) : 'home'
}

function parsePage(p: URLSearchParams): Page {
  return PAGES.find(page => page === p.get('page')) ?? inferPage(p)
}


function positiveInt(value: string | null): number | null {
  const n = Number(value)
  return value !== null && Number.isInteger(n) && n > 0 ? n : null
}

export function parseUrl(search: string): UrlState {
  const p = new URLSearchParams(search)
  return {
    s: p.get('s'),
    page: parsePage(p),
    present: p.get('present') === '1',
    renderer: RENDERERS.find(r => r === p.get('renderer')) ?? 'react-flow',
    area: p.get('area'),
    term: p.get('term'),
    team: p.get('team'),
    blast: p.get('blast') === '1' ? p.get('s') : p.get('blast'),
    flows: p.get('flows'),
    flow: p.get('flow'),
    unit: p.get('unit'),
    chapter: positiveInt(p.get('chapter')),
    edge: p.get('edge'),
    drawer: p.get('drawer'),
    ep: p.get('ep'),
    flag: p.get('flag'),
    file: p.get('file'),
    resource: p.get('resource'),
    event: WRITE_EVENT_PARAMS.find(e => e === p.get('event')) ?? null,
    listener: p.get('listener'),
    lev: p.get('lev'),
    lkind: p.get('lkind'),
    lgrade: p.get('lgrade'),
    notFound: null,
  }
}

type PageKey = 's' | 'area' | 'term' | 'team' | 'blast' | 'flows' | 'flow' | 'unit' | 'chapter' | 'edge' | 'drawer' | 'ep' | 'flag' | 'file' | 'resource' | 'event' | 'listener' | 'lev' | 'lkind' | 'lgrade'

const KEY_ORDER: readonly PageKey[] = ['s', 'area', 'term', 'team', 'blast', 'flows', 'flow', 'unit', 'chapter', 'edge', 'drawer', 'ep', 'flag', 'file', 'resource', 'event', 'listener', 'lev', 'lkind', 'lgrade']
const ARCHITECTURE_KEYS: readonly PageKey[] = ['s', 'area', 'edge', 'drawer', 'ep']
const PAGE_KEYS: Record<Page, readonly PageKey[]> = {
  home: [],
  areas: ['area', 'term'],
  microservices: ARCHITECTURE_KEYS,
  monolith: ARCHITECTURE_KEYS,
  flows: ['flows', 'flow', 'unit', 'chapter', 'flag', 'file', 'drawer', 'ep'],
  resources: ['resource', 'event', 'listener', 'lev', 'lkind', 'lgrade'],
  impact: ['blast'],
  ownership: ['team'],
}
const PARENT_KEY: Partial<Record<PageKey, PageKey>> = { term: 'area', unit: 'flow', chapter: 'flow', ep: 'drawer', event: 'resource', listener: 'resource', lev: 'resource', lkind: 'resource', lgrade: 'resource' }

export function toQueryString(state: UrlState): string {
  const p = new URLSearchParams()
  if (state.page !== 'home') {
    p.set('page', state.page)
  }
  const allowed = new Set(PAGE_KEYS[state.page])
  for (const key of KEY_ORDER) {
    const value = state[key]
    const parent = PARENT_KEY[key]
    if (value !== null && allowed.has(key) && (!parent || state[parent] !== null)) {
      p.set(key, String(value))
    }
  }
  if (state.renderer !== 'react-flow') {
    p.set('renderer', state.renderer)
  }
  if (state.present) {
    p.set('present', '1')
  }
  return p.toString()
}

export function pagePatch(page: Page): Partial<UrlState> {
  return { page, s: null, area: null, term: null, team: null, blast: null, flows: null, flow: null, unit: null, chapter: null, edge: null, drawer: null, ep: null, flag: null, file: null, resource: null, event: null, listener: null, lev: null, lkind: null, lgrade: null }
}

export function selectServicePatch(name: string): Partial<UrlState> {
  return { ...pagePatch(servicePage(name)), s: name }
}

export function canGoBack(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'inApp' in state
}

export function isNavigation(prev: UrlState, p: Partial<UrlState>): boolean {
  return NAVIGATION_KEYS.some(k => k in p && p[k] !== prev[k] && p[k] !== null)
}

function forgetOtherPages(next: UrlState): UrlState {
  const kept = new Set(PAGE_KEYS[next.page])
  return KEY_ORDER.reduce<UrlState>((st, key) => (kept.has(key) ? st : { ...st, [key]: null }), next)
}

type HistoryWriter = Pick<History, 'pushState' | 'replaceState'> & { state?: unknown }

export function commitPatch(
  prev: UrlState,
  p: Partial<UrlState>,
  opts: { push?: boolean } | undefined,
  history: HistoryWriter,
  pathname: string,
): UrlState {
  const merged = { ...prev, notFound: null, ...p }
  const next = p.page !== undefined && p.page !== prev.page ? forgetOtherPages(merged) : merged
  const qs = toQueryString(next)
  const url = qs ? `${pathname}?${qs}` : pathname
  if (opts?.push ?? isNavigation(prev, p)) {
    history.pushState({ inApp: true }, '', url)
  } else {
    history.replaceState(history.state ?? null, '', url)
  }
  return next
}

/**
 * URL-backed state. `validate` strips params that don't resolve against the
 * dataset (unknown service, retired flow id…) and records the first one in
 * `notFound` so stale shared links show where they went wrong.
 *
 * Picks (a new navigation-key value or a page change) push history so Back
 * undoes them; closes and toggles replace. `opts.push` overrides the rule.
 */
export function useUrlState(validate: (st: UrlState) => UrlState) {
  const [state, setState] = useState<UrlState>(() => validate(parseUrl(window.location.search)))
  const current = useRef(state)

  useEffect(() => {
    const onPop = () => {
      current.current = validate(parseUrl(window.location.search))
      setState(current.current)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [validate])

  // History is written here, never inside a setState updater: StrictMode runs updaters twice.
  const patch = useCallback((p: Partial<UrlState>, opts?: { push?: boolean }) => {
    current.current = commitPatch(current.current, p, opts, window.history, window.location.pathname)
    setState(current.current)
  }, [])

  return [state, patch] as const
}
