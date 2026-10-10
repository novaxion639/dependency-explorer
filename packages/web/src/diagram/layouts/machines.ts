import { allStates, type CrudOperation, type MachineState, type StateMachine } from '@dependency-explorer/data'

export interface Transition { from: string; to: string; label?: string }

export function machineLane(id: string): string {
  return `lane:machine:${id}`
}

export function stateNodeId(id: string): string {
  return `m:${id}`
}

export function stateKey(state: MachineState): string {
  return state.unit ?? stateNodeId(state.id)
}

export function catchTargets(machine: StateMachine): Set<string> {
  return new Set([machine.errorHandler, ...allStates(machine).map(s => s.catchTo)].flatMap(id => (id === undefined ? [] : [id])))
}

function isContainer(state: MachineState): boolean {
  return state.type === 'map' || state.type === 'parallel'
}

function successors(state: MachineState): string[] {
  return [state.next, state.default, ...(state.choices ?? []).map(c => c.next)].flatMap(id => (id === undefined ? [] : [id]))
}

function orderLevel(states: MachineState[], starts: string[], skip: ReadonlySet<string>): MachineState[] {
  const byId = new Map(states.filter(s => !skip.has(s.id)).map(s => [s.id, s]))
  const discovered: string[] = []
  const onStack = new Set<string>()
  const back = new Set<string>()
  const walk = (id: string) => {
    const state = byId.get(id)
    if (!state || discovered.includes(id)) {
      return
    }
    discovered.push(id)
    onStack.add(id)
    for (const next of successors(state)) {
      if (onStack.has(next)) {
        back.add(`${id}>${next}`)
      } else {
        walk(next)
      }
    }
    onStack.delete(id)
  }
  starts.forEach(walk)
  states.forEach(s => walk(s.id))
  const forward = (id: string): string[] => {
    const state = byId.get(id)
    return state ? successors(state).filter(next => byId.has(next) && !back.has(`${id}>${next}`)) : []
  }
  const pending = new Map(discovered.map(id => [id, 0]))
  for (const id of discovered) {
    for (const next of forward(id)) {
      pending.set(next, (pending.get(next) ?? 0) + 1)
    }
  }
  const placed: MachineState[] = []
  const ready = discovered.filter(id => pending.get(id) === 0)
  while (ready.length > 0) {
    ready.sort((a, b) => discovered.indexOf(a) - discovered.indexOf(b))
    const id = ready.shift() ?? ''
    const state = byId.get(id)
    if (state) {
      placed.push(state)
    }
    for (const next of forward(id)) {
      const left = (pending.get(next) ?? 0) - 1
      pending.set(next, left)
      if (left === 0) {
        ready.push(next)
      }
    }
  }
  return placed
}

export function machineOrder(machine: StateMachine): string[] {
  const skip = catchTargets(machine)
  const expand = (states: MachineState[]): string[] => states.flatMap(s => {
    if (s.type === 'map') {
      return expand(orderLevel(s.states ?? [], s.states?.[0] ? [s.states[0].id] : [], skip))
    }
    if (s.type === 'parallel') {
      return expand(orderLevel(s.states ?? [], s.branches ?? [], skip))
    }
    return [stateKey(s)]
  })
  return expand(orderLevel(machine.states, [machine.start], skip))
}

export function machineTransitions(machine: StateMachine): Transition[] {
  const skip = catchTargets(machine)
  const byId = new Map(allStates(machine).map(s => [s.id, s]))
  const entries = (id: string): string[] => {
    const state = byId.get(id)
    if (!state) {
      return []
    }
    if (state.type === 'map') {
      return entries(state.states?.[0]?.id ?? '')
    }
    if (state.type === 'parallel') {
      return (state.branches ?? []).flatMap(entries)
    }
    return [stateKey(state)]
  }
  const exits = (state: MachineState): string[] => (isContainer(state)
    ? (state.states ?? []).filter(s => s.next === undefined && s.type !== 'choice' && !skip.has(s.id)).flatMap(exits)
    : [stateKey(state)])
  return allStates(machine).filter(s => !skip.has(s.id)).flatMap(state => {
    const targets: Array<{ to: string; label?: string }> = [
      ...(state.next === undefined ? [] : [{ to: state.next }]),
      ...(state.default === undefined ? [] : [{ to: state.default }]),
      ...(state.choices ?? []).map(c => ({ to: c.next, label: c.when })),
    ]
    return targets.flatMap(({ to, label }) => exits(state).flatMap(from => entries(to).map(target => (label === undefined ? { from, to: target } : { from, to: target, label }))))
  })
}

export function machineFrames(machine: StateMachine): Array<{ id: string; state: string; label: string; members: string[] }> {
  const skip = catchTargets(machine)
  const nested = (state: MachineState): MachineState[] => (state.states ?? []).flatMap(s => [s, ...nested(s)])
  return allStates(machine).filter(isContainer).map(state => ({
    id: `frame:${state.id}`,
    state: state.id,
    label: `${state.type === 'map' ? (state.concurrency ? `map ×${state.concurrency}` : 'map') : 'parallel'}${state.catches ? ' ⚠' : ''}`,
    members: nested(state).filter(s => !isContainer(s) && !skip.has(s.id)).map(stateKey),
  }))
}

export function machineStores(machine: StateMachine): Array<{ store: string; label: string; crud: CrudOperation[] }> {
  const stores = new Map<string, { labels: string[]; states: string[]; crud: Set<CrudOperation> }>()
  for (const state of allStates(machine)) {
    for (const access of state.stores ?? []) {
      const entry = stores.get(access.store) ?? { labels: [], states: [], crud: new Set<CrudOperation>() }
      if (access.label !== undefined && !entry.labels.includes(access.label)) {
        entry.labels.push(access.label)
      }
      if (!entry.states.includes(state.label)) {
        entry.states.push(state.label)
      }
      access.crud?.forEach(c => entry.crud.add(c))
      stores.set(access.store, entry)
    }
  }
  return [...stores].map(([store, e]) => ({
    store,
    label: e.labels.length > 0 ? `${e.labels.join(', ')} · ${e.states.join(', ')}` : e.states.join(', '),
    crud: [...e.crud],
  }))
}
