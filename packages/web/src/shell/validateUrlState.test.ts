import { describe, it, expect } from 'vitest'
import { connectivityMap } from '@dependency-explorer/data'
import { edgeKey, parseUrl } from '../hooks/useUrlState'
import { validateUrlState } from './validateUrlState'

describe('validateUrlState', () => {
  it('keeps the page and flags an unknown flow', () => {
    const st = validateUrlState(parseUrl('?page=flows&flow=retired-flow'))
    expect([st.page, st.flow, st.notFound?.param]).toEqual(['flows', null, 'flow'])
  })
  it('sends an unknown service back to the microservices overview', () => {
    const st = validateUrlState(parseUrl('?s=svc-nope'))
    expect([st.page, st.s, st.notFound?.param]).toEqual(['microservices', null, 's'])
  })
  it('opens the monolith page for skello-app', () => {
    expect(validateUrlState(parseUrl('?page=microservices&s=skello-app')).page).toBe('monolith')
  })
})

describe('edge lists', () => {
  it('drops an edge list with any unknown key', () => {
    const [a, b] = connectivityMap.connections
    if (!a || !b) {
      throw new Error('dataset has fewer than two connections')
    }
    const pair = `${edgeKey(a.from, a.to, a.protocol)},${edgeKey(b.from, b.to, b.protocol)}`
    expect(validateUrlState(parseUrl(`?page=microservices&edge=${pair}`)).edge).toBe(pair)
    expect(validateUrlState(parseUrl(`?page=microservices&edge=${edgeKey(a.from, a.to, a.protocol)},svc-x~svc-y~sqs`)).edge).toBeNull()
  })
})
