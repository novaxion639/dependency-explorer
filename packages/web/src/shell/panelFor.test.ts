import { describe, it, expect } from 'vitest'
import { edgeKey, parseUrl } from '../hooks/useUrlState'
import { map } from './dataIndexes'
import { panelFor } from './panelFor'

const [one, two] = map.connections
const edges = [one, two].flatMap(c => (c ? [edgeKey(c.from, c.to, c.protocol)] : [])).join(',')
const single = one ? edgeKey(one.from, one.to, one.protocol) : ''

describe('panelFor', () => {
  it('shows a flow unit before anything else on the flows page', () => {
    expect(panelFor(parseUrl('?page=flows&flow=shift-creation&unit=cu-create-service&drawer=svc-punch')).kind).toBe('unit')
  })

  it('lists the connections behind an aggregated edge', () => {
    expect(panelFor(parseUrl(`?page=microservices&edge=${encodeURIComponent(edges)}&drawer=svc-punch`)).kind).toBe('connections')
  })

  it('details a single edge before the endpoint drawer', () => {
    expect(panelFor(parseUrl(`?page=microservices&edge=${encodeURIComponent(single)}&drawer=svc-punch`)).kind).toBe('edge')
  })

  it('opens the endpoint drawer with its highlighted endpoint', () => {
    expect(panelFor(parseUrl('?page=microservices&drawer=svc-punch&ep=e1'))).toMatchObject({ kind: 'endpoints', highlight: 'e1', service: { name: 'svc-punch' } })
  })

  it('shows an area slice on the architecture pages', () => {
    expect(panelFor(parseUrl('?page=monolith&area=planning')).kind).toBe('slice')
  })

  it.each([
    ['the home page', ''],
    ['an area on the flows page', '?page=flows&area=planning'],
    ['a flow without a unit', '?page=flows&flow=shift-creation'],
    ['an unknown drawer service', '?page=microservices&drawer=no-such-service'],
  ])('shows no panel for %s', (_name, qs) => {
    expect(panelFor(parseUrl(qs)).kind).toBe('none')
  })
})
