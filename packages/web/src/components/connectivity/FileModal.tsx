import type { ServiceFlow } from '@dependency-explorer/data'
import type { FileIndexEntry } from '../../utils/fileIndex'

// Landing view for ⌘K file entities (?file=<service>/<path>): which
// documented flows traverse this source file — the incident/refactor
// question answered from the map.
interface Props {
  entry: FileIndexEntry
  onSelectFlow: (flow: ServiceFlow) => void
  onOpenRoute: (id: string) => void
  onOpenResource: (id: string) => void
  onClose: () => void
}

export function FileModal({ entry, onSelectFlow, onOpenRoute, onOpenResource, onClose }: Props) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 201,
          width: 560,
          maxHeight: '80vh',
          background: '#1a1d27',
          border: '1px solid #2e3250',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid #2e3250',
          background: '#242736',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexShrink: 0,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📄</span>
              <code style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.path}</code>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              <span style={{ color: '#818cf8' }}>{entry.service}</span>
              {entry.labels.length > 0 && <>{' · '}{entry.labels.join(' · ')}</>}
              {' · '}traversed by {entry.flows.length} flow{entry.flows.length === 1 ? '' : 's'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#64748b',
              cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Traversing flows */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '10px 0' }}>
          {entry.flows.map(flow => (
            <div
              key={flow.id}
              style={{
                margin: '0 12px 8px',
                background: '#13151f',
                border: '1px solid #2e3250',
                borderRadius: 8,
                padding: '10px 14px',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
              onClick={() => onSelectFlow(flow)}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#94a3b8')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#2e3250')}
            >
              <div style={{ fontWeight: 700, fontSize: 12, color: '#e2e8f0' }}>{flow.name}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
                {(flow.codeUnits ?? []).filter(u => u.service === entry.service && u.path === entry.path)
                  .map(u => u.label).join(' · ')}
              </div>
              <div style={{ fontSize: 10, color: '#4f6ef7', marginTop: 6 }}>View code detail →</div>
            </div>
          ))}
          {entry.routes.length > 0 && (
            <section aria-label="Routes served by this file" style={{ margin: '4px 18px 0' }}>
              <h3 style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>Routes served by this file ({entry.routes.length})</h3>
              <ul style={{ listStyle: 'none', fontSize: 11 }}>
                {entry.routes.map(id => (
                  <li key={id}>
                    <button type="button" onClick={() => onOpenRoute(id)} style={{ background: 'transparent', border: 'none', padding: '2px 0', color: '#10b981', cursor: 'pointer', fontFamily: 'monospace', textAlign: 'left' }}>{id}</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {entry.resources.length > 0 && (
            <section aria-label="Resources this file touches" style={{ margin: '4px 18px 0' }}>
              <h3 style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>Resources this file touches ({entry.resources.length})</h3>
              <ul style={{ listStyle: 'none', fontSize: 11 }}>
                {entry.resources.map(r => (
                  <li key={`${r.id}-${r.relation}`}>
                    <button type="button" onClick={() => onOpenResource(r.id)} style={{ background: 'transparent', border: 'none', padding: '2px 0', color: '#f59e0b', cursor: 'pointer', fontFamily: 'monospace', textAlign: 'left' }}>{r.relation} {r.id}</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
