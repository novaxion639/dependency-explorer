import { getBezierPath, EdgeLabelRenderer, BaseEdge, type EdgeProps } from '@xyflow/react'
import type { ServiceConnection } from '../../types-connectivity'

interface Props extends EdgeProps {
  data?: { connection: ServiceConnection }
}

export function ConnectivityEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, style, markerEnd,
  data,
}: Props) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  })

  const conn = data?.connection
  const count = conn?.usedEndpoints?.length ?? 0

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {count > 0 && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
            }}
          >
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10,
              background: '#1a1d27', border: '1px solid #2e3250', color: '#64748b',
              whiteSpace: 'nowrap',
            }}>
              {count} endpoint{count !== 1 ? 's' : ''}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
