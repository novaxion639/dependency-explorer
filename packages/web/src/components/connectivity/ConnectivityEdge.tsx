import { getBezierPath, EdgeLabelRenderer, BaseEdge, type EdgeProps } from '@xyflow/react'
import type { ServiceConnection, FlowFailure } from '@dependency-explorer/data'

interface Props extends EdgeProps {
  data?: { connection?: ServiceConnection; failure?: FlowFailure }
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
  const failure = data?.failure

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
          {failure && (failure.dlq || failure.dlqAbsent) && (
            <span
              title={failure.dlq
                ? `DLQ: ${failure.dlq}${failure.retryPolicy ? ` — ${failure.retryPolicy}` : ''}${failure.onError ? `\n${failure.onError}` : ''}`
                : `No DLQ on this hop (confirmed)${failure.onError ? `\n${failure.onError}` : ''}`}
              style={{
                fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                whiteSpace: 'nowrap', pointerEvents: 'all',
                background: failure.dlq ? '#10b98122' : '#ef444422',
                border: `1px solid ${failure.dlq ? '#10b98144' : '#ef444444'}`,
                color: failure.dlq ? '#10b981' : '#ef4444',
              }}
            >
              {failure.dlq ? `🛡 ${failure.dlq}` : '⚠ no DLQ'}
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
