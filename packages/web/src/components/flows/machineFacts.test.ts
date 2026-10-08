import { describe, it, expect } from 'vitest'
import { ServiceFlowSchema } from '@dependency-explorer/data'
import { autoFlow, dpaeFlow } from '../../diagram/layouts/fixtures'
import { machineFacts, panelIds } from './machineFacts'

describe('machineFacts', () => {
  it('describes a machine: its states in run order, the states falling to its error handler, and its stores', () => {
    const facts = machineFacts(autoFlow, 'sm-auto')
    expect(facts?.title).toBe('AutoAssign state machine')
    expect(facts?.lines).toEqual(expect.arrayContaining([
      { label: 'Service', value: 'svc' },
      { label: 'States', value: 'fetch data (task), empty? (choice), filter users (task), all filtered? (choice), eligibility per batch (task), aggregate (task), solve (task), assign shifts (task), finish job (task)' },
      { label: 'Falls to the error handler', value: 'fetch data, filter users, per batch, aggregate, solve, assign shifts, finish job' },
      { label: 'jobs', value: 'job status · fetch data, filter users, aggregate, assign shifts, finish job' },
    ]))
  })
  it('describes a state through its id or its handler unit', () => {
    expect(machineFacts(autoFlow, 'empty')?.lines).toEqual(expect.arrayContaining([
      { label: 'Type', value: 'choice' },
      { label: 'no batches', value: '→ finish job' },
      { label: 'Default', value: '→ filter users' },
    ]))
    expect(machineFacts(autoFlow, 'u-fetch')?.lines).toEqual(expect.arrayContaining([{ label: 'Next', value: '→ empty?' }, { label: 'On error', value: '→ error handler' }]))
  })
  it('lists the machine states touching a store, and nothing for an unknown id', () => {
    expect(machineFacts(autoFlow, 'jobs')?.lines).toEqual([{ label: 'Machine states', value: 'fetch data, filter users, aggregate, assign shifts, finish job' }])
    expect(machineFacts(autoFlow, 'nope')).toBeNull()
  })
  it('opens the panel on units, stores, machines and states', () => {
    const ids = panelIds(autoFlow)
    expect(['u-fetch', 'jobs', 'sm-auto', 'empty', 'map'].every(id => ids.has(id))).toBe(true)
    expect(ids.has('svc')).toBe(false)
  })
  it('names only the states that fall to the machine error handler, and leaves the row out when none does', () => {
    expect(machineFacts(dpaeFlow, 'sm-dpae')?.lines.map(l => l.label)).not.toContain('Falls to the error handler')
    const flow = ServiceFlowSchema.parse({
      id: 'own', name: 'Own', description: 'd', steps: [], codeUnits: [{ id: 'u-a', service: 'svc', kind: 'job', label: 'A' }, { id: 'u-e', service: 'svc', kind: 'job', label: 'E' }],
      stateMachines: [{ id: 'sm', service: 'svc', machine: 'M', label: 'M', file: 'f.ts', start: 'a', errorHandler: 'e', states: [
        { id: 'a', name: 'A', type: 'task', label: 'a', unit: 'u-a', catches: true, catchTo: 'own', next: 'b' },
        { id: 'b', name: 'B', type: 'task', label: 'b', catches: true },
        { id: 'own', name: 'Own', type: 'task', label: 'own notifier' },
        { id: 'e', name: 'E', type: 'task', label: 'error handler', unit: 'u-e' },
      ] }],
    })
    expect(machineFacts(flow, 'sm')?.lines).toContainEqual({ label: 'Falls to the error handler', value: 'b' })
  })
})
