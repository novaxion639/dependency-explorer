import { describe, it, expect } from 'vitest'
import { parseUrl } from '../hooks/useUrlState'
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
