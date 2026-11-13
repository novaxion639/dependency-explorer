import type { ServiceFlow } from '@dependency-explorer/schema'
import { allStates } from './state-machines'

export function flowRefIds(flow: ServiceFlow): Set<string> {
  return new Set([
    ...(flow.codeUnits ?? []).map(u => u.id),
    ...(flow.infraNodes ?? []).map(n => n.id),
    ...flow.steps.flatMap(s => [s.from, s.to]),
    ...(flow.codeEdges ?? []).flatMap(e => [e.from, e.to]),
    ...(flow.stateMachines ?? []).flatMap(m => [m.id, ...allStates(m).map(s => s.id)]),
  ])
}
