import { describe, it, expect } from 'vitest'
import { parseUrl } from '../hooks/useUrlState'
import { breadcrumb } from './crumbs'

const labels = (qs: string) => breadcrumb(parseUrl(qs)).map(c => c.label)

describe('breadcrumb', () => {
  it('names the module path of each page', () => {
    expect(labels('')).toEqual([])
    expect(labels('?page=microservices&s=svc-punch')).toEqual(['Architecture', 'Microservices', 'svc-punch'])
    expect(labels('?page=monolith')).toEqual(['Architecture', 'Monolith'])
    expect(labels('?page=flows&flow=shift-creation')).toEqual(['Flows', 'Shift Creation'])
    expect(labels('?page=resources&resource=pg:skello_production.shifts')).toEqual(['Resources', 'shifts'])
    expect(labels('?page=impact&blast=svc-requests')).toEqual(['Impact', 'svc-requests'])
  })
  it('links every crumb but the last', () => {
    const crumbs = breadcrumb(parseUrl('?page=microservices&s=svc-punch'))
    expect(crumbs.map(c => c.patch === null)).toEqual([false, false, true])
    expect(crumbs[1]?.patch).toEqual({ page: 'microservices', s: null, edge: null, drawer: null, ep: null })
  })
})
