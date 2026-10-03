import { useCallback, useEffect, useRef, useState } from 'react'
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
 *   ?page=flows&flow=shift-creation      flow page (&detail=code | sequence)
 *   ?page=flows&flows=svc-users          flows a service takes part in
 *   ?page=flows&file=svc-punch/src/…     flows traversing a file
 *   ?page=flows&flag=FEATUREDEV_X        flows gated by a feature flag
 *   ?page=resources&resource=pg:…        resource page (change impact)
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
  /** 'code' = code-detail view of the open flow graph, 'sequence' = its sequence diagram */
  detail: 'code' | 'sequence' | null
  unit: string | null
  chapter: number | null
  edge: string | null
  drawer: string | null
  ep: string | null
  flag: string | null
  file: string | null
  resource: string | null
  /** A permalink param that did not resolve — rendered as a banner, never serialized */
  notFound: { param: 'area' | 'term' | 'flow' | 's' | 'resource'; value: string } | null
}

export const EDGE_SEP = '~'
export const EDGE_LIST_SEP = ','
const AREA_PAGES = new Set<Page>(['areas', 'microservices', 'monolith'])

const NAVIGATION_KEYS = ['page', 'area', 's', 'team', 'flows', 'flow', 'drawer', 'flag', 'file', 'resource'] as const

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

export type FlowDetail = UrlState['detail']

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
    detail: p.get('detail') === 'code' ? 'code' : p.get('detail') === 'sequence' ? 'sequence' : null,
    unit: p.get('unit'),
    chapter: positiveInt(p.get('chapter')),
    edge: p.get('edge'),
    drawer: p.get('drawer'),
    ep: p.get('ep'),
    flag: p.get('flag'),
    file: p.get('file'),
    resource: p.get('resource'),
    notFound: null,
  }
}

export function toQueryString(state: UrlState): string {
  const p = new URLSearchParams()
  if (state.page !== 'home') {
    p.set('page', state.page)
  }
  if (state.s) {
    p.set('s', state.s)
  }
  if (AREA_PAGES.has(state.page) && state.area) {
    p.set('area', state.area)
    if (state.page === 'areas' && state.term) {
      p.set('term', state.term)
    }
  }
  if (state.page === 'ownership' && state.team) {
    p.set('team', state.team)
  }
  if (state.blast) {
    p.set('blast', state.blast)
  }
  if (state.flows) {
    p.set('flows', state.flows)
  }
  if (state.flow) {
    p.set('flow', state.flow)
    if (state.detail) {
      p.set('detail', state.detail)
    }
    if (state.unit) {
      p.set('unit', state.unit)
    }
    if (state.chapter) {
      p.set('chapter', String(state.chapter))
    }
  }
  if (state.edge) {
    p.set('edge', state.edge)
  }
  if (state.drawer) {
    p.set('drawer', state.drawer)
    if (state.ep) {
      p.set('ep', state.ep)
    }
  }
  if (state.flag) {
    p.set('flag', state.flag)
  }
  if (state.file) {
    p.set('file', state.file)
  }
  if (state.resource) {
    p.set('resource', state.resource)
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
  return { page, s: null, area: null, term: null, team: null, blast: null, flows: null, flow: null, detail: null, unit: null, chapter: null, edge: null, drawer: null, ep: null, flag: null, file: null, resource: null }
}

export function selectServicePatch(name: string): Partial<UrlState> {
  return { ...pagePatch(servicePage(name)), s: name }
}

export function canGoBack(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'inApp' in state
}

export function isNavigation(prev: UrlState, p: Partial<UrlState>): boolean {
  return NAVIGATION_KEYS.some(k => k in p && p[k] !== prev[k])
}

type HistoryWriter = Pick<History, 'pushState' | 'replaceState'> & { state?: unknown }

export function commitPatch(
  prev: UrlState,
  p: Partial<UrlState>,
  opts: { push?: boolean } | undefined,
  history: HistoryWriter,
  pathname: string,
): UrlState {
  const next = { ...prev, notFound: null, ...p }
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
 * Navigation-grade changes (NAVIGATION_KEYS) push a history entry so
 * back/forward behaves; everything else replaces in place. `opts.push`
 * overrides the rule.
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
