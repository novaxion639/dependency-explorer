import { describe, it, expect } from 'vitest'
import { ServiceFlowSchema } from '@dependency-explorer/schema'
import { allStates, machineProblems } from './state-machines'

const flow = (machine: unknown) => ServiceFlowSchema.parse({
  id: 'f', name: 'F', description: 'd', steps: [],
  codeUnits: [
    { id: 'h-fetch', service: 'svc', kind: 'job', label: 'Fetch', path: 'src/Fetch.ts' },
    { id: 'h-err', service: 'svc', kind: 'job', label: 'Err', path: 'src/Err.ts' },
    { id: 'other', service: 'elsewhere', kind: 'job', label: 'Other' },
  ],
  infraNodes: [{ id: 'jobs', type: 'mongodb', label: 'jobs' }],
  stateMachines: [machine],
})

const fetchState = { id: 'fetch', name: 'sfnFetch', type: 'task', label: 'fetch', unit: 'h-fetch', catches: true, stores: [{ store: 'jobs', label: 'status' }], next: 'check' }
const checkState = { id: 'check', name: 'Check', type: 'choice', label: 'empty?', choices: [{ when: 'no batches', next: 'map' }], default: 'map' }
const mapState = { id: 'map', name: 'MapState', type: 'map', label: 'per batch', concurrency: 10, states: [{ id: 'inner', name: 'sfnInner', type: 'pass', label: 'inner' }] }
const errState = { id: 'err', name: 'sfnErr', type: 'task', label: 'error handler', unit: 'h-err' }
const machine = { id: 'sm', service: 'svc', machine: 'Machine', label: 'Machine', file: 'sfn.ts', start: 'fetch', errorHandler: 'err', states: [fetchState, checkState, mapState, errState] }

describe('state machines', () => {
  it('parse onto a flow', () => {
    expect(flow(machine).stateMachines?.[0]?.states).toHaveLength(4)
  })
  it('list every state, nested ones included', () => {
    const m = flow(machine).stateMachines?.[0]
    expect(m && allStates(m).map(s => s.id)).toEqual(['fetch', 'check', 'map', 'inner', 'err'])
  })
  it('accept a sound machine', () => {
    expect(machineProblems(flow(machine))).toEqual([])
  })
  it('reject unknown transitions, units, stores and duplicate names', () => {
    const bad = { ...machine, start: 'nope', states: [
      { ...fetchState, next: 'ghost', unit: 'other', stores: [{ store: 'gone' }] },
      { ...checkState, name: 'sfnFetch', default: 'ghost2' },
      mapState, errState,
    ] }
    expect(machineProblems(flow(bad))).toEqual([
      'f#sm: start "nope" is not a state',
      'f#sm: fetch next "ghost" is not a state at its level',
      'f#sm: fetch unit "other" is not a svc unit of the flow',
      'f#sm: fetch store "gone" is not an infra node of the flow',
      'f#sm: check default "ghost2" is not a state at its level',
      'f#sm: state name "sfnFetch" repeats',
    ])
  })
  it('reject a parallel branch that is not one of its own states', () => {
    const parallel = { ...machine, start: 'par', states: [{ id: 'par', name: 'Par', type: 'parallel', label: 'p', branches: ['x'], states: [{ id: 'y', name: 'Y', type: 'pass', label: 'y' }] }, errState] }
    expect(machineProblems(flow(parallel))).toEqual(['f#sm: par branch "x" is not one of its states'])
  })
  it('reject an error handler that is not a top-level state', () => {
    expect(machineProblems(flow({ ...machine, errorHandler: 'nope' }))).toEqual(['f#sm: errorHandler "nope" is not a top-level state'])
  })
  it('reject a unit backing two states and a state id that repeats another flow id', () => {
    const shared = { ...machine, states: [fetchState, checkState, mapState, { ...errState, unit: 'h-fetch' }, { id: 'jobs', name: 'Dup', type: 'pass', label: 'dup' }] }
    expect(machineProblems(flow(shared))).toEqual([
      'f#sm: unit "h-fetch" backs more than one state (fetch, err)',
      'f#sm: state id "jobs" repeats another id of the flow',
    ])
  })
})
