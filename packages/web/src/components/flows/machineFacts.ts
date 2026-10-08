import { allStates, type MachineState, type ServiceFlow, type StateMachine } from '@dependency-explorer/data'
import { catchTargets, machineOrder, machineStores, stateKey } from '../../diagram/layouts/machines'

export interface Fact { label: string; value: string }

function stateLabel(machine: StateMachine, id: string | undefined): string {
  return allStates(machine).find(s => s.id === id)?.label ?? id ?? ''
}

function machineSummary(flow: ServiceFlow, machine: StateMachine): Fact[] {
  const byKey = new Map(allStates(machine).map(s => [stateKey(s), s]))
  const targets = catchTargets(machine)
  const storeLabel = (id: string) => (flow.infraNodes ?? []).find(n => n.id === id)?.label ?? id
  return [
    { label: 'Service', value: machine.service },
    { label: 'Definition', value: machine.file },
    { label: 'States', value: machineOrder(machine).flatMap(key => {
      const state = byKey.get(key)
      return state ? [`${state.label} (${state.type})`] : []
    }).join(', ') },
    { label: 'Falls to the error handler', value: allStates(machine).filter(s => s.catches && !targets.has(s.id)).map(s => s.label).join(', ') },
    ...machineStores(machine).map(s => ({ label: storeLabel(s.store), value: s.label })),
  ]
}

function stateSummary(machine: StateMachine, state: MachineState): Fact[] {
  const to = (id: string | undefined) => `→ ${stateLabel(machine, id)}`
  const target = state.catchTo ?? machine.errorHandler
  return [
    { label: 'Machine', value: machine.label },
    { label: 'Type', value: state.type },
    ...(state.next === undefined ? [] : [{ label: 'Next', value: to(state.next) }]),
    ...(state.choices ?? []).map(c => ({ label: c.when, value: to(c.next) })),
    ...(state.default === undefined ? [] : [{ label: 'Default', value: to(state.default) }]),
    ...(state.catches && target !== undefined ? [{ label: 'On error', value: to(target) }] : []),
  ]
}

export function machineFacts(flow: ServiceFlow, id: string): { title: string; lines: Fact[] } | null {
  const machines = flow.stateMachines ?? []
  const machine = machines.find(m => m.id === id)
  if (machine) {
    return { title: machine.label, lines: machineSummary(flow, machine) }
  }
  for (const m of machines) {
    const state = allStates(m).find(s => s.id === id || s.unit === id)
    if (state) {
      return { title: state.label, lines: stateSummary(m, state) }
    }
  }
  const touching = machines.flatMap(m => allStates(m).filter(s => (s.stores ?? []).some(x => x.store === id)).map(s => s.label))
  return touching.length > 0 ? { title: id, lines: [{ label: 'Machine states', value: touching.join(', ') }] } : null
}

export function panelIds(flow: ServiceFlow): Set<string> {
  return new Set([
    ...(flow.codeUnits ?? []).map(u => u.id),
    ...(flow.infraNodes ?? []).map(n => n.id),
    ...(flow.stateMachines ?? []).flatMap(m => [m.id, ...allStates(m).map(s => s.id)]),
  ])
}
