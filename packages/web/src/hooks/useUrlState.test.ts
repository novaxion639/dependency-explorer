import { describe, it, expect } from 'vitest'
import { parseUrl, toQueryString, isNavigation, commitPatch } from './useUrlState'

describe('parseUrl', () => {
  it('lands on the areas home with no params', () => {
    expect(parseUrl('').view).toBe('areas')
  })

  it('keeps service permalinks on the service view', () => {
    expect(parseUrl('?s=svc-punch').view).toBe('services')
  })

  it('maps legacy domain links to the areas home', () => {
    const st = parseUrl('?view=domains&domain=hr')
    expect(st.view).toBe('areas')
    expect('domain' in st).toBe(false)
  })

  it('reads area and term', () => {
    const st = parseUrl('?view=areas&area=planning&term=Poste')
    expect([st.area, st.term]).toEqual(['planning', 'Poste'])
  })

  it('reads the context view', () => {
    expect(parseUrl('?view=context').view).toBe('context')
  })
})

describe('toQueryString', () => {
  it('omits the default view and round-trips', () => {
    for (const qs of ['', 's=svc-punch', 'view=areas&area=planning&term=Poste', 'view=context', 'view=teams&team=team-salsa', 'flow=shift-creation&detail=code']) {
      expect(toQueryString(parseUrl(`?${qs}`))).toBe(qs)
    }
  })

  it('writes view=services when no service is selected', () => {
    expect(toQueryString({ ...parseUrl(''), view: 'services' })).toBe('view=services')
  })
})

describe('isNavigation', () => {
  const base = parseUrl('?s=svc-punch')

  it('treats view, area, service, flow and modal changes as navigation', () => {
    expect(isNavigation(base, { view: 'areas' })).toBe(true)
    expect(isNavigation(base, { flow: 'shift-creation' })).toBe(true)
    expect(isNavigation(base, { s: 'svc-users' })).toBe(true)
    expect(isNavigation({ ...base, flow: 'x' }, { flow: null })).toBe(true)
  })

  it('treats toggles and unchanged values as in-place updates', () => {
    expect(isNavigation(base, { blast: true })).toBe(false)
    expect(isNavigation(base, { detail: 'code' })).toBe(false)
    expect(isNavigation(base, { s: 'svc-punch' })).toBe(false)
  })
})

describe('commitPatch', () => {
  function recorder() {
    const calls: Array<[string, string]> = []
    return {
      calls,
      history: {
        pushState: (_data: unknown, _unused: string, url?: string | URL | null) => { calls.push(['push', String(url)]) },
        replaceState: (_data: unknown, _unused: string, url?: string | URL | null) => { calls.push(['replace', String(url)]) },
      },
    }
  }

  it('writes history exactly once per navigation and returns the next state', () => {
    const { calls, history } = recorder()
    const next = commitPatch(parseUrl('?s=svc-punch'), { flow: 'badging-review' }, undefined, history, '/')
    expect(next.flow).toBe('badging-review')
    expect(calls).toEqual([['push', '/?s=svc-punch&flow=badging-review']])
  })

  it('replaces in place for toggles and clears notFound', () => {
    const { calls, history } = recorder()
    const prev = { ...parseUrl('?s=svc-punch&flow=x'), notFound: { param: 'area' as const, value: 'nope' } }
    const next = commitPatch(prev, { detail: 'code' }, undefined, history, '/')
    expect(next.notFound).toBeNull()
    expect(calls).toEqual([['replace', '/?s=svc-punch&flow=x&detail=code']])
  })
})

describe('detail=sequence', () => {
  it('parses and round-trips the sequence mode', () => {
    expect(parseUrl('?flow=f&detail=sequence').detail).toBe('sequence')
    expect(toQueryString(parseUrl('?flow=f&detail=sequence'))).toBe('flow=f&detail=sequence')
  })
})

describe('resources', () => {
  it('parses and round-trips the index and a resource page', () => {
    expect(parseUrl('?view=resources').view).toBe('resources')
    const st = parseUrl('?resource=pg%3Askello_production.shifts')
    expect(st.resource).toBe('pg:skello_production.shifts')
    expect(toQueryString(st)).toBe('resource=pg%3Askello_production.shifts')
  })
  it('treats opening a resource as navigation', () => {
    expect(isNavigation(parseUrl(''), { resource: 'sqs:jobs' })).toBe(true)
  })
})
