import { useInternalNode, getBezierPath, BaseEdge, Position, type EdgeProps } from '@xyflow/react'
import type { InternalNode } from '@xyflow/react'

function getFloatingEdgeParams(source: InternalNode, target: InternalNode) {
  const sw = source.measured?.width ?? 200
  const sh = source.measured?.height ?? 60
  const tw = target.measured?.width ?? 160
  const th = target.measured?.height ?? 64

  const srcPos = source.internals.positionAbsolute
  const tgtPos = target.internals.positionAbsolute

  const srcCX = srcPos.x + sw / 2
  const srcCY = srcPos.y + sh / 2
  const tgtCX = tgtPos.x + tw / 2
  const tgtCY = tgtPos.y + th / 2

  const dx = tgtCX - srcCX
  const dy = tgtCY - srcCY

  let sourcePos: Position, targetPos: Position
  let sx: number, sy: number, tx: number, ty: number

  if (Math.abs(dx) >= Math.abs(dy)) {
    // Horizontal dominant — connect left/right
    if (dx >= 0) {
      sourcePos = Position.Right; sx = srcPos.x + sw; sy = srcCY
      targetPos = Position.Left;  tx = tgtPos.x;      ty = tgtCY
    } else {
      sourcePos = Position.Left;  sx = srcPos.x;      sy = srcCY
      targetPos = Position.Right; tx = tgtPos.x + tw; ty = tgtCY
    }
  } else {
    // Vertical dominant — connect top/bottom
    if (dy >= 0) {
      sourcePos = Position.Bottom; sx = srcCX; sy = srcPos.y + sh
      targetPos = Position.Top;    tx = tgtCX; ty = tgtPos.y
    } else {
      sourcePos = Position.Top;    sx = srcCX; sy = srcPos.y
      targetPos = Position.Bottom; tx = tgtCX; ty = tgtPos.y + th
    }
  }

  return { sx, sy, tx, ty, sourcePos, targetPos }
}

export function FloatingDbEdge({ id, source, target, style, markerEnd }: EdgeProps) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)

  if (!sourceNode || !targetNode) return null

  const { sx, sy, tx, ty, sourcePos, targetPos } = getFloatingEdgeParams(sourceNode, targetNode)

  const [edgePath] = getBezierPath({
    sourceX: sx, sourceY: sy, sourcePosition: sourcePos,
    targetX: tx, targetY: ty, targetPosition: targetPos,
  })

  return <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
}
