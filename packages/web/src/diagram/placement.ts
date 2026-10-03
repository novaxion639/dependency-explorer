import { withPositions } from './exportImage'
import type { Point } from './geometry'
import type { DiagramModel } from './model'

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
  return placement.model === model.id ? withPositions(model, placement.positions) : model
}
