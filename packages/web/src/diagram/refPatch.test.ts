import { describe, it, expect } from 'vitest'
import { pagePatch } from '../hooks/useUrlState'
import { refPatch } from './refPatch'

describe('refPatch', () => {
  it('turns each click target into a URL patch', () => {
    expect(refPatch({ type: 'service', name: 'svc-punch' })).toEqual({ drawer: 'svc-punch', ep: null, edge: null })
    expect(refPatch({ type: 'area', id: 'planning' })).toEqual({ area: 'planning', drawer: null, ep: null, edge: null })
    expect(refPatch({ type: 'resource', id: 'pg:x' })).toEqual({ ...pagePatch('resources'), resource: 'pg:x' })
    expect(refPatch({ type: 'connections', keys: ['a~b~rest', 'c~d~sqs'] })).toEqual({ edge: 'a~b~rest,c~d~sqs', drawer: null, ep: null })
    expect(refPatch({ type: 'unit', id: 'cu-create-service' })).toEqual({ unit: 'cu-create-service' })
  })
})
