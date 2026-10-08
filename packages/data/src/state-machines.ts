import type { MachineState, ServiceFlow, StateMachine } from '@dependency-explorer/schema'

export function allStates(machine: StateMachine): MachineState[] {
  const walk = (states: MachineState[]): MachineState[] => states.flatMap(s => [s, ...walk(s.states ?? [])])
  return walk(machine.states)
}

export function machineProblems(flow: ServiceFlow): string[] {
  const units = new Map((flow.codeUnits ?? []).map(u => [u.id, u]))
  const stores = new Set((flow.infraNodes ?? []).map(n => n.id))
  const taken = new Set([...units.keys(), ...stores, ...(flow.stateMachines ?? []).map(m => m.id)])
  return (flow.stateMachines ?? []).flatMap(machine => {
    const at = `${flow.id}#${machine.id}`
    const problems: string[] = []
    const level = (states: MachineState[]) => {
      const here = new Set(states.map(s => s.id))
      const known = (id: string) => here.has(id) || id === machine.errorHandler
      for (const s of states) {
        const targets: Array<[string, string | undefined]> = [['next', s.next], ['default', s.default], ['catchTo', s.catchTo], ...(s.choices ?? []).map((c): [string, string] => ['choice', c.next])]
        for (const [field, target] of targets) {
          if (target !== undefined && !known(target)) {
            problems.push(`${at}: ${s.id} ${field} "${target}" is not a state at its level`)
          }
        }
        if (s.unit !== undefined && units.get(s.unit)?.service !== machine.service) {
          problems.push(`${at}: ${s.id} unit "${s.unit}" is not a ${machine.service} unit of the flow`)
        }
        for (const { store } of s.stores ?? []) {
          if (!stores.has(store)) {
            problems.push(`${at}: ${s.id} store "${store}" is not an infra node of the flow`)
          }
        }
        const inner = new Set((s.states ?? []).map(x => x.id))
        for (const b of s.branches ?? []) {
          if (!inner.has(b)) {
            problems.push(`${at}: ${s.id} branch "${b}" is not one of its states`)
          }
        }
        level(s.states ?? [])
      }
    }
    if (!machine.states.some(s => s.id === machine.start)) {
      problems.push(`${at}: start "${machine.start}" is not a state`)
    }
    if (machine.errorHandler !== undefined && !machine.states.some(s => s.id === machine.errorHandler)) {
      problems.push(`${at}: errorHandler "${machine.errorHandler}" is not a top-level state`)
    }
    level(machine.states)
    const names = allStates(machine).map(s => s.name)
    for (const name of new Set(names.filter((n, i) => names.indexOf(n) !== i))) {
      problems.push(`${at}: state name "${name}" repeats`)
    }
    const backed = new Map<string, string[]>()
    for (const st of allStates(machine)) {
      if (st.unit !== undefined) {
        backed.set(st.unit, [...(backed.get(st.unit) ?? []), st.id])
      }
    }
    for (const [unit, states] of backed) {
      if (states.length > 1) {
        problems.push(`${at}: unit "${unit}" backs more than one state (${states.join(', ')})`)
      }
    }
    for (const st of allStates(machine)) {
      if (taken.has(st.id)) {
        problems.push(`${at}: state id "${st.id}" repeats another id of the flow`)
      }
      taken.add(st.id)
    }
    return problems
  })
}
