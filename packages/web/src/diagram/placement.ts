import type { Point } from './geometry'
import type { Box, DiagramModel } from './model'

export interface Placement { model: string; positions: ReadonlyMap<string, Point> }

export const NO_PLACEMENT: Placement = { model: '', positions: new Map() }

export function moveNode(placement: Placement, modelId: string, id: string, position: Point): Placement {
  const kept = placement.model === modelId ? placement.positions : new Map<string, Point>()
  return { model: modelId, positions: new Map(kept).set(id, position) }
}

export function placed(model: DiagramModel, placement: Placement): DiagramModel {
  if (placement.model !== model.id || !placement.positions.size) {
    return model
  }
  const nodes = model.nodes.map(n => {
    const p = placement.positions.get(n.id)
    return p ? { ...n, x: p.x, y: p.y } : n
  })
  return {
    ...model,
    nodes,
    width: Math.max(model.width, ...nodes.map(n => n.x + n.w)),
    height: Math.max(model.height, ...nodes.map(n => n.y + n.h)),
  }
}

export function placedForExport(model: DiagramModel, placement: Placement): DiagramModel {
  const moved = placed(model, placement)
  const all: Box[] = [...moved.groups, ...moved.nodes]
  const dx = Math.min(0, ...all.map(b => b.x))
  const dy = Math.min(0, ...all.map(b => b.y))
  if (!dx && !dy) {
    return moved
  }
  const shift = <T extends Box>(b: T): T => ({ ...b, x: b.x - dx, y: b.y - dy })
  return { ...moved, nodes: moved.nodes.map(shift), groups: moved.groups.map(shift), width: moved.width - dx, height: moved.height - dy }
}
