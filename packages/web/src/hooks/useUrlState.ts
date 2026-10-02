import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Permalink state — every shareable bit of UI state lives in the query string
 * (never in a path segment: the bundle must work from any static host or
 * SSO proxy without rewrite rules, see ADR-0005).
 *
 *   (no params)                  areas home (default landing)
 *   ?view=areas&area=planning    area page
 *   ?term=Poste                  glossary term highlighted on the area page
 *   ?view=context                system context
 *   ?s=svc-users                 selected service (service view)
 *   ?view=services               service view without a selection
 *   ?view=teams                  ownership view (per-team service ownership)
 *   ?team=team-salsa             team focused inside the ownership view
 *   ?blast=svc-users             impact panel for a failing service or resource id
 *   ?flows=svc-users             flow LIST modal for a service
 *   ?flow=shift-creation         flow GRAPH modal (by flow id)
 *   ?edge=from~to~protocol       connection popup (protocol disambiguates
 *                                multi-channel pairs, e.g. rest vs sns)
 *   ?drawer=svc-users            endpoint drawer for a service
 *   ?ep=api-sign-up              endpoint highlighted inside the drawer
 *   ?flag=FEATUREDEV_X           feature-flag view (flows gated by the flag)
 *   ?file=svc-punch/src/…        reverse index view (flows traversing a file)
 *   ?view=resources              resource index
 *   ?resource=pg:skello_production.shifts   resource page (change impact)
 */
export type View = 'areas' | 'context' | 'services' | 'resources' | 'teams'

export interface UrlState {
  s: string | null
  view: View
  area: string | null
  term: string | null
  team: string | null
  blast: string | null
  flows: string | null
  flow: string | null
  /** 'code' = code-detail view of the open flow graph, 'sequence' = its sequence diagram */
  detail: 'code' | 'sequence' | null
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

const VIEWS: readonly View[] = ['areas', 'context', 'services', 'resources', 'teams']
const NAVIGATION_KEYS = ['view', 'area', 's', 'team', 'flows', 'flow', 'drawer', 'flag', 'file', 'resource'] as const

export function edgeKey(from: string, to: string, protocol: string): string {
  return [from, to, protocol].join(EDGE_SEP)
}

function defaultView(s: string | null): View {
  return s ? 'services' : 'areas'
}

function parseView(raw: string | null, s: string | null): View {
  if (raw === 'domains') {
    return 'areas'
  }
  return VIEWS.find(v => v === raw) ?? defaultView(s)
}

export type FlowDetail = UrlState['detail']

export function parseUrl(search: string): UrlState {
  const p = new URLSearchParams(search)
  return {
    s: p.get('s'),
    view: parseView(p.get('view'), p.get('s')),
    area: p.get('area'),
    term: p.get('term'),
    team: p.get('team'),
    blast: p.get('blast') === '1' ? p.get('s') : p.get('blast'),
    flows: p.get('flows'),
    flow: p.get('flow'),
    detail: p.get('detail') === 'code' ? 'code' : p.get('detail') === 'sequence' ? 'sequence' : null,
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
  if (state.s) {
    p.set('s', state.s)
  }
  if (state.view !== defaultView(state.s) || (state.view === 'areas' && state.area)) {
    p.set('view', state.view)
  }
  if (state.view === 'areas' && state.area) {
    p.set('area', state.area)
    if (state.term) {
      p.set('term', state.term)
    }
  }
  if (state.view === 'teams' && state.team) {
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
  return p.toString()
}

export function isNavigation(prev: UrlState, p: Partial<UrlState>): boolean {
  return NAVIGATION_KEYS.some(k => k in p && p[k] !== prev[k])
}

type HistoryWriter = Pick<History, 'pushState' | 'replaceState'>

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
    history.pushState(null, '', url)
  } else {
    history.replaceState(null, '', url)
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
