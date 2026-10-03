import { describe, it, expect } from 'vitest'
import { pagePatch } from '../hooks/useUrlState'
import { refPatch, selectPatch } from './refPatch'

describe('refPatch', () => {
  it('turns each click target into a URL patch', () => {
    expect(refPatch({ type: 'service', name: 'svc-punch' })).toEqual({ drawer: 'svc-punch', ep: null, edge: null })
    expect(refPatch({ type: 'area', id: 'planning' })).toEqual({ area: 'planning', drawer: null, ep: null, edge: null })
    expect(refPatch({ type: 'resource', id: 'pg:x' })).toEqual({ ...pagePatch('resources'), resource: 'pg:x' })
    expect(refPatch({ type: 'connections', keys: ['a~b~rest', 'c~d~sqs'] })).toEqual({ edge: 'a~b~rest,c~d~sqs', drawer: null, ep: null })
    expect(refPatch({ type: 'unit', id: 'cu-create-service' })).toEqual({ unit: 'cu-create-service' })
  })
})

describe('selectPatch', () => {
  it('writes nothing for panel-only targets while presenting, the panel being hidden', () => {
    expect(selectPatch({ type: 'unit', id: 'cu-x' }, true)).toBeNull()
    expect(selectPatch({ type: 'service', name: 'svc-punch' }, true)).toBeNull()
    expect(selectPatch({ type: 'connections', keys: ['a~b~rest'] }, true)).toBeNull()
  })
  it('keeps visible effects while presenting, and every target while exploring', () => {
    expect(selectPatch({ type: 'area', id: 'planning' }, true)).toEqual(refPatch({ type: 'area', id: 'planning' }))
    expect(selectPatch({ type: 'resource', id: 'pg:x' }, true)).toEqual(refPatch({ type: 'resource', id: 'pg:x' }))
    expect(selectPatch({ type: 'unit', id: 'cu-x' }, false)).toEqual({ unit: 'cu-x' })
  })
})
