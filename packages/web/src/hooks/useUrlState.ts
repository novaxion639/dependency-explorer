import { useCallback, useEffect, useState } from 'react'

/**
 * Permalink state — every shareable bit of UI state lives in the query string
 * (never in a path segment: the bundle must work from any static host or
 * SSO proxy without rewrite rules, see ADR-0005).
 *
 *   ?s=svc-users                 selected service
 *   ?view=domains                domain view (default: services)
 *   ?domain=hr                   sidebar domain filter
 *   ?blast=1                     blast-radius overlay on
 *   ?flows=svc-users             flow LIST modal for a service
 *   ?flow=shift-creation         flow GRAPH modal (by flow id)
 *   ?edge=from~to~protocol       connection popup (protocol disambiguates
 *                                multi-channel pairs, e.g. rest vs sns)
 *   ?drawer=svc-users            endpoint drawer for a service
 *   ?ep=api-sign-up              endpoint highlighted inside the drawer
 */
export interface UrlState {
  s: string | null
  view: 'services' | 'domains'
  domain: string | null
  blast: boolean
  flows: string | null
  flow: string | null
  /** 'code' = code-detail view of the open flow graph */
  detail: 'code' | null
  edge: string | null
  drawer: string | null
  ep: string | null
}

export const EDGE_SEP = '~'

export function edgeKey(from: string, to: string, protocol: string): string {
  return [from, to, protocol].join(EDGE_SEP)
}

export function parseUrl(search: string): UrlState {
  const p = new URLSearchParams(search)
  return {
    s: p.get('s'),
    view: p.get('view') === 'domains' ? 'domains' : 'services',
    domain: p.get('domain'),
    blast: p.get('blast') === '1',
    flows: p.get('flows'),
    flow: p.get('flow'),
    detail: p.get('detail') === 'code' ? 'code' : null,
    edge: p.get('edge'),
    drawer: p.get('drawer'),
    ep: p.get('ep'),
  }
}

function serialize(state: UrlState): string {
  const p = new URLSearchParams()
  if (state.s) p.set('s', state.s)
  if (state.view !== 'services') p.set('view', state.view)
  if (state.domain) p.set('domain', state.domain)
  if (state.blast) p.set('blast', '1')
  if (state.flows) p.set('flows', state.flows)
  if (state.flow) p.set('flow', state.flow)
  if (state.flow && state.detail) p.set('detail', state.detail)
  if (state.edge) p.set('edge', state.edge)
  if (state.drawer) p.set('drawer', state.drawer)
  if (state.drawer && state.ep) p.set('ep', state.ep)
  const qs = p.toString()
  return qs ? `${window.location.pathname}?${qs}` : window.location.pathname
}

/**
 * URL-backed state. `validate` strips params that don't resolve against the
 * dataset (unknown service, retired flow id…) so stale shared links degrade
 * to the nearest valid view instead of rendering a broken one.
 *
 * `patch(…, { push: true })` adds a history entry — use it for navigation-grade
 * changes (service selection, opening a flow) so back/forward behaves;
 * everything else replaces in place.
 */
export function useUrlState(validate: (st: UrlState) => UrlState) {
  const [state, setState] = useState<UrlState>(() => validate(parseUrl(window.location.search)))

  useEffect(() => {
    const onPop = () => setState(validate(parseUrl(window.location.search)))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [validate])

  const patch = useCallback((p: Partial<UrlState>, opts?: { push?: boolean }) => {
    setState(prev => {
      const next = { ...prev, ...p }
      const url = serialize(next)
      if (opts?.push) window.history.pushState(null, '', url)
      else window.history.replaceState(null, '', url)
      return next
    })
  }, [])

  return [state, patch] as const
}
