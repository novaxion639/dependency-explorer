import { getBezierPath, EdgeLabelRenderer, BaseEdge, type EdgeProps } from '@xyflow/react'
import type { ServiceConnection } from '@dependency-explorer/data'

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
  const isAsync = conn?.communicationType === 'async'

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'none',
            display: 'flex', gap: 3, alignItems: 'center',
          }}
        >
          {isAsync && (
            <span style={{
              fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
              background: '#e0761b22', color: '#e0761b', whiteSpace: 'nowrap',
              textTransform: 'uppercase',
            }}>
              {conn?.protocol ?? 'async'}
            </span>
          )}
          {count > 0 && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10,
              background: '#1a1d27', border: '1px solid #2e3250', color: '#64748b',
              whiteSpace: 'nowrap',
            }}>
              {count} endpoint{count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
