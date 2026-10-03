import type { Emphasis } from './focus'
import type { EdgeMode, NodeKind } from './model'

export interface Paint { stroke: string; text: string; opacity: number }

export const PAINT: Record<Emphasis, Paint> = {
  normal: { stroke: 'var(--ink)', text: 'var(--ink)', opacity: 1 },
  dim: { stroke: 'var(--rule-strong)', text: 'var(--ink-faint)', opacity: 0.45 },
  on: { stroke: 'var(--ink)', text: 'var(--ink)', opacity: 1 },
  origin: { stroke: 'var(--ink)', text: 'var(--card)', opacity: 1 },
  fails: { stroke: 'var(--fails)', text: 'var(--fails)', opacity: 1 },
  starves: { stroke: 'var(--starves)', text: 'var(--starves)', opacity: 1 },
  degrades: { stroke: 'var(--degrades)', text: 'var(--degrades)', opacity: 1 },
}

export const DASH: Record<EdgeMode, string | undefined> = { sync: undefined, async: '6 4', 'data-feed': '2 4' }
export const MODE_LABEL: Record<EdgeMode, string> = { sync: 'sync', async: 'async', 'data-feed': 'data feed' }
export const EMPHASIS_WORD: Partial<Record<Emphasis, string>> = { origin: 'origin', fails: 'fails', starves: 'starves', degrades: 'degrades' }

const TINTED = new Set<NodeKind>(['subject', 'summary', 'monolith', 'store'])

export const NODE_DASH: Partial<Record<NodeKind, string>> = { job: '6 4', unmapped: '6 4' }

export function nodeFill(kind: NodeKind, emphasis: Emphasis): string | null {
  if (emphasis === 'on') {
    return 'var(--highlight)'
  }
  if (emphasis === 'origin') {
    return 'var(--ink)'
  }
  if (kind === 'unmapped') {
    return null
  }
  return TINTED.has(kind) ? 'var(--paper-2)' : 'var(--card)'
}

export function strokeWidth(weight: number): number {
  return Math.min(1.5 + Math.log2(Math.max(weight, 1)) * 1.5, 7)
}
