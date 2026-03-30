import type { ConnectivityMap, ServiceConnection, ServiceEndpoint } from '../../types-connectivity'

const METHOD_COLOR: Record<string, string> = {
  GET: '#10b981',
  POST: '#3b82f6',
  PUT: '#f59e0b',
  PATCH: '#f59e0b',
  DELETE: '#ef4444',
}

interface Props {
  connection: ServiceConnection
  map: ConnectivityMap
  position: { x: number; y: number }
  onSeeMore: (endpoints: ServiceEndpoint[], serviceName: string) => void
  onClose: () => void
}

export function EdgePopup({ connection, map, position, onSeeMore, onClose }: Props) {
  const targetService = map.services.find(s => s.name === connection.to)
  const usedEndpoints: ServiceEndpoint[] = (connection.usedEndpoints ?? [])
    .map(id => targetService?.endpoints.find(e => e.id === id))
    .filter(Boolean) as ServiceEndpoint[]

  const top3 = usedEndpoints.slice(0, 3)
  const hasMore = usedEndpoints.length > 3 || (targetService?.endpoints.length ?? 0) > top3.length

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 99 }}
      />

      {/* Popup card */}
      <div
        style={{
          position: 'fixed',
          left: Math.min(position.x, window.innerWidth - 340),
          top: Math.min(position.y, window.innerHeight - 320),
          zIndex: 100,
          width: 320,
          background: '#1a1d27',
          border: '1px solid #2e3250',
          borderRadius: 10,
          boxShadow: '0 8px 32px #00000066',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #2e3250', background: '#242736' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#818cf8' }}>{connection.from}</span>
              <span style={{ color: '#3e4363' }}>→</span>
              <span style={{ color: '#4f6ef7' }}>{connection.to}</span>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{connection.description}</div>
          <div style={{ fontSize: 10, color: '#3b82f6', marginTop: 2 }}>
            via <code style={{ fontSize: 10 }}>{connection.sdkPackage}</code>
          </div>
        </div>

        {/* Top 3 endpoints */}
        <div style={{ padding: '8px 0' }}>
          {top3.length === 0 && (
            <div style={{ padding: '8px 14px', fontSize: 12, color: '#64748b' }}>No endpoint details available.</div>
          )}
          {top3.map(ep => (
            <div key={ep.id} style={{ padding: '6px 14px', borderBottom: '1px solid #1e2235' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, width: 44, textAlign: 'center',
                  padding: '1px 0', borderRadius: 3, flexShrink: 0,
                  background: (METHOD_COLOR[ep.method] ?? '#64748b') + '22',
                  color: METHOD_COLOR[ep.method] ?? '#64748b',
                }}>
                  {ep.method}
                </span>
                <code style={{ fontSize: 11, color: '#94a3b8' }}>{ep.path}</code>
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, paddingLeft: 50 }}>{ep.description}</div>
            </div>
          ))}
        </div>

        {/* See more */}
        {hasMore && (
          <div style={{ padding: '8px 14px', borderTop: '1px solid #2e3250' }}>
            <button
              onClick={() => onSeeMore(targetService?.endpoints ?? [], connection.to)}
              style={{
                width: '100%', padding: '6px', borderRadius: 6,
                background: '#6366f1', border: 'none', color: '#fff',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              See all endpoints for {connection.to} →
            </button>
          </div>
        )}
      </div>
    </>
  )
}
