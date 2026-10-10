import { describe, it, expect } from 'vitest'
import { ServiceFlowSchema } from '@dependency-explorer/data'
import { autoFlow, dpaeFlow } from './fixtures'
import { machineFrames, machineOrder, machineStores, machineTransitions } from './machines'

const auto = autoFlow.stateMachines?.[0]
const dpae = dpaeFlow.stateMachines?.[0]

describe('machines', () => {
  it('orders states after every state that leads to them, depth-first among equals, catch targets out', () => {
    expect(auto && machineOrder(auto)).toEqual(['u-fetch', 'm:empty', 'u-filter', 'm:filtered', 'u-elig', 'u-agg', 'u-solve', 'u-assign', 'u-finish'])
    expect(dpae && machineOrder(dpae)).toEqual(['m:init', 'm:wait', 'u-check', 'm:pending', 'm:increment', 'm:exhausted', 'm:clean', 'u-update'])
  })
  it('turns next, default and choice rules into transitions, entering and leaving maps through their inner states', () => {
    expect(auto && machineTransitions(auto)).toEqual(expect.arrayContaining([
      { from: 'u-fetch', to: 'm:empty' },
      { from: 'm:empty', to: 'u-finish', label: 'no batches' },
      { from: 'm:empty', to: 'u-filter' },
      { from: 'm:filtered', to: 'u-elig' },
      { from: 'u-elig', to: 'u-agg' },
    ]))
  })
  it('frames a map with its concurrency and lists each store once with the states that touch it', () => {
    expect(auto && machineFrames(auto)).toEqual([{ id: 'frame:map', state: 'map', label: 'map ×10 ⚠', members: ['u-elig'] }])
    expect(auto && machineStores(auto).find(s => s.store === 'jobs')).toEqual({ store: 'jobs', label: 'job status · fetch data, filter users, aggregate, assign shifts, finish job', crud: ['update'] })
  })
})

describe('machines with a choice inside a map', () => {
  it('leaves the map only from its ending states, never from a choice', () => {
    const flow = ServiceFlowSchema.parse({
      id: 'inner', name: 'Inner', description: 'd', steps: [],
      codeUnits: ['u-a', 'u-b', 'u-z'].map(id => ({ id, service: 'svc', kind: 'job', label: id })),
      stateMachines: [{ id: 'sm', service: 'svc', machine: 'M', label: 'M', file: 'f.ts', start: 'map', states: [
        { id: 'map', name: 'Map', type: 'map', label: 'map', next: 'z', states: [
          { id: 'a', name: 'A', type: 'task', label: 'a', unit: 'u-a', next: 'c' },
          { id: 'c', name: 'C', type: 'choice', label: 'again?', choices: [{ when: 'retry', next: 'a' }], default: 'b' },
          { id: 'b', name: 'B', type: 'task', label: 'b', unit: 'u-b' },
        ] },
        { id: 'z', name: 'Z', type: 'task', label: 'z', unit: 'u-z' },
      ] }],
    })
    const machine = flow.stateMachines?.[0]
    const into = (machine ? machineTransitions(machine) : []).filter(t => t.to === 'u-z').map(t => t.from)
    expect(into).toEqual(['u-b'])
  })
})
