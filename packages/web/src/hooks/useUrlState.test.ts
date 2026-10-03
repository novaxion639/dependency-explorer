import { describe, it, expect } from 'vitest'
import { parseUrl, toQueryString, isNavigation, commitPatch, selectServicePatch, pagePatch, canGoBack } from './useUrlState'

describe('parseUrl', () => {
  it('lands on home with no params', () => {
    expect(parseUrl('').page).toBe('home')
  })
  it('reads the page key', () => {
    expect(parseUrl('?page=ownership&team=team-salsa').page).toBe('ownership')
  })
  it('maps legacy view keys to pages', () => {
    expect(parseUrl('?view=domains&domain=hr').page).toBe('areas')
    expect(parseUrl('?view=areas&area=planning&term=Poste').page).toBe('areas')
    expect(parseUrl('?view=context').page).toBe('microservices')
    expect(parseUrl('?view=services').page).toBe('microservices')
    expect(parseUrl('?view=resources').page).toBe('resources')
    expect(parseUrl('?view=teams&team=team-salsa').page).toBe('ownership')
  })
  it('infers the page from legacy service links', () => {
    expect(parseUrl('?s=svc-punch').page).toBe('microservices')
    expect(parseUrl('?s=skello-app').page).toBe('monolith')
  })
  it('infers the flows page from detail keys', () => {
    const st = parseUrl('?s=svc-punch&flow=shift-creation&detail=code')
    expect([st.page, st.flow, st.detail, st.s]).toEqual(['flows', 'shift-creation', 'code', 'svc-punch'])
    expect(parseUrl('?file=svc-punch/src/a.ts').page).toBe('flows')
    expect(parseUrl('?flag=FEATUREDEV_X').page).toBe('flows')
    expect(parseUrl('?flows=svc-punch').page).toBe('flows')
  })
  it('opens resources and impact from their keys', () => {
    expect(parseUrl('?resource=pg:skello_production.shifts').page).toBe('resources')
    const legacyBlast = parseUrl('?blast=1&s=svc-users')
    expect([legacyBlast.page, legacyBlast.blast]).toEqual(['impact', 'svc-users'])
    expect(parseUrl('?blast=sqs:transaction').page).toBe('impact')
  })
  it('falls back from an unknown page', () => {
    expect(parseUrl('?page=bogus').page).toBe('home')
    expect(parseUrl('?page=bogus&s=svc-punch').page).toBe('microservices')
  })
  it('reads present mode', () => {
    expect(parseUrl('?present=1').present).toBe(true)
    expect(parseUrl('').present).toBe(false)
  })
})

describe('toQueryString', () => {
  it('round-trips the page form', () => {
    for (const qs of ['', 'page=microservices&s=svc-punch', 'page=areas&area=planning&term=Poste', 'page=ownership&team=team-salsa', 'page=flows&flow=shift-creation&detail=code', 'page=impact&blast=svc-users', 'page=resources&resource=pg%3Askello_production.shifts', 'present=1']) {
      expect(toQueryString(parseUrl(`?${qs}`))).toBe(qs)
    }
  })
  it('rewrites a legacy link into the page form', () => {
    expect(toQueryString(parseUrl('?view=context'))).toBe('page=microservices')
  })
})

describe('isNavigation', () => {
  const base = parseUrl('?s=svc-punch')

  it('treats page, area, service, flow and modal changes as navigation', () => {
    expect(isNavigation(base, { page: 'areas' })).toBe(true)
    expect(isNavigation(base, { flow: 'shift-creation' })).toBe(true)
    expect(isNavigation(base, { s: 'svc-users' })).toBe(true)
    expect(isNavigation({ ...base, flow: 'x' }, { flow: null })).toBe(true)
  })

  it('treats toggles and unchanged values as in-place updates', () => {
    expect(isNavigation(base, { blast: 'svc-a' })).toBe(false)
    expect(isNavigation(base, { detail: 'code' })).toBe(false)
    expect(isNavigation(base, { s: 'svc-punch' })).toBe(false)
    expect(isNavigation(base, { present: true })).toBe(false)
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
    expect(calls).toEqual([['push', '/?page=microservices&s=svc-punch&flow=badging-review']])
  })

  it('replaces in place for toggles and clears notFound', () => {
    const { calls, history } = recorder()
    const prev = { ...parseUrl('?s=svc-punch&flow=x'), notFound: { param: 'area' as const, value: 'nope' } }
    const next = commitPatch(prev, { detail: 'code' }, undefined, history, '/')
    expect(next.notFound).toBeNull()
    expect(calls).toEqual([['replace', '/?page=flows&s=svc-punch&flow=x&detail=code']])
  })
})

describe('detail=sequence', () => {
  it('parses and round-trips the sequence mode', () => {
    expect(parseUrl('?flow=f&detail=sequence').detail).toBe('sequence')
    expect(toQueryString(parseUrl('?flow=f&detail=sequence'))).toBe('page=flows&flow=f&detail=sequence')
  })
})

describe('resources', () => {
  it('parses and round-trips the index and a resource page', () => {
    expect(parseUrl('?view=resources').page).toBe('resources')
    const st = parseUrl('?resource=pg%3Askello_production.shifts')
    expect(st.resource).toBe('pg:skello_production.shifts')
    expect(toQueryString(st)).toBe('page=resources&resource=pg%3Askello_production.shifts')
  })
  it('treats opening a resource as navigation', () => {
    expect(isNavigation(parseUrl(''), { resource: 'sqs:jobs' })).toBe(true)
  })
})

describe('blast permalinks', () => {
  it('names the impact origin, upgrading the legacy ?blast=1 to the selected service', () => {
    expect(parseUrl('?s=svc-a&blast=1').blast).toBe('svc-a')
    expect(parseUrl('?blast=sqs%3Ajobs').blast).toBe('sqs:jobs')
    expect(toQueryString(parseUrl('?blast=sqs%3Ajobs'))).toBe('page=impact&blast=sqs%3Ajobs')
  })
})

describe('selectServicePatch', () => {
  it('opens skello-app on the monolith page', () => {
    expect(selectServicePatch('skello-app').page).toBe('monolith')
  })
  it('leaves a resource page for the service view', () => {
    expect(selectServicePatch('svc-a')).toMatchObject({ s: 'svc-a', page: 'microservices', resource: null, edge: null, drawer: null, ep: null })
  })
})

describe('pagePatch', () => {
  function recorder() {
    const calls: Array<[string, unknown, string]> = []
    return {
      calls,
      history: {
        pushState: (data: unknown, _unused: string, url?: string | URL | null) => { calls.push(['push', data, String(url)]) },
        replaceState: (data: unknown, _unused: string, url?: string | URL | null) => { calls.push(['replace', data, String(url)]) },
      },
    }
  }
  it('leaves a deep page for home without carrying its keys', () => {
    const { calls, history } = recorder()
    commitPatch(parseUrl('?page=flows&s=svc-punch&flow=shift-creation&file=a&flag=F'), pagePatch('home'), undefined, history, '/')
    expect(calls.map(c => c[2])).toEqual(['/'])
  })
  it('opens a module at its top level', () => {
    const { calls, history } = recorder()
    commitPatch(parseUrl('?page=monolith&s=skello-app&edge=a~b~rest'), pagePatch('microservices'), undefined, history, '/')
    expect(calls.map(c => c[2])).toEqual(['/?page=microservices'])
  })
  it('marks in-app history entries so Back knows it stays in the app', () => {
    const { calls, history } = recorder()
    commitPatch(parseUrl(''), { page: 'flows', flow: 'shift-creation' }, undefined, history, '/')
    expect(canGoBack(calls[0]?.[1])).toBe(true)
    expect(canGoBack(null)).toBe(false)
  })
  it('opens a service without the previous page detail keys', () => {
    expect(selectServicePatch('svc-a')).toMatchObject({ flow: null, file: null, flag: null, flows: null, blast: null })
  })
})

describe('renderer', () => {
  it('parses an unknown renderer as React Flow', () => {
    expect(parseUrl('?page=microservices&renderer=bogus').renderer).toBe('react-flow')
    expect(parseUrl('?page=microservices&renderer=svg').renderer).toBe('svg')
    expect(parseUrl('?renderer=mermaid').renderer).toBe('mermaid')
  })
  it('writes the renderer only when it is not the default, and keeps it across pages', () => {
    expect(toQueryString(parseUrl('?page=microservices'))).toBe('page=microservices')
    expect(toQueryString(parseUrl('?page=microservices&renderer=svg'))).toBe('page=microservices&renderer=svg')
    expect(pagePatch('monolith')).not.toHaveProperty('renderer')
  })
})

describe('architecture permalinks', () => {
  it('keeps the spotlit area on the architecture pages only', () => {
    expect(toQueryString(parseUrl('?page=microservices&area=planning'))).toBe('page=microservices&area=planning')
    expect(toQueryString(parseUrl('?page=monolith&area=planning'))).toBe('page=monolith&area=planning')
    expect(toQueryString(parseUrl('?page=flows&area=planning'))).toBe('page=flows')
  })
})

describe('flow page keys', () => {
  it('reads and writes the unit and chapter of the open flow', () => {
    const st = parseUrl('?page=flows&flow=shift-creation&unit=cu-create-service&chapter=2')
    expect([st.unit, st.chapter]).toEqual(['cu-create-service', 2])
    expect(toQueryString(st)).toBe('page=flows&flow=shift-creation&unit=cu-create-service&chapter=2')
  })
  it('ignores a chapter that is not a positive whole number', () => {
    for (const c of ['0', '-1', '1.5', 'two']) {
      expect(parseUrl(`?flow=f&chapter=${c}`).chapter, c).toBeNull()
    }
  })
  it('replaces history for unit and chapter changes', () => {
    const base = parseUrl('?page=flows&flow=f')
    expect(isNavigation(base, { unit: 'u' })).toBe(false)
    expect(isNavigation(base, { chapter: 2 })).toBe(false)
  })
  it('clears them with every page change', () => {
    expect(pagePatch('flows')).toMatchObject({ unit: null, chapter: null })
  })
})
