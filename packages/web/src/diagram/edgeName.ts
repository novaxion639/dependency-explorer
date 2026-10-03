import type { DiagramEdge } from './model'

export function edgeName(from: string, to: string, edge: Pick<DiagramEdge, 'label' | 'condition'>): string {
  return `${from} → ${to}: ${edge.label}${edge.condition ? ` (if ${edge.condition})` : ''}`
}
