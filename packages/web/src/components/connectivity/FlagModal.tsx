import type { ServiceFlow } from '@dependency-explorer/data'
import type { FlagRegistryEntry } from '../../utils/flagRegistry'

// Landing view for ⌘K flag entities and 🚩 chips (?flag=FEATUREDEV_X):
// which flows does this flag gate, and where inside them.
interface Props {
  entry: FlagRegistryEntry
  onSelectFlow: (flow: ServiceFlow) => void
  onClose: () => void
}

export function FlagModal({ entry, onSelectFlow, onClose }: Props) {
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
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🚩</span>
              <code>{entry.name}</code>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                background: entry.kind === 'dev' ? '#a78bfa22' : '#10b98122',
                color: entry.kind === 'dev' ? '#a78bfa' : '#10b981',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {entry.kind}
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              gates {entry.flows.length} flow{entry.flows.length === 1 ? '' : 's'}
              {entry.scope ? ` · canary scope: ${entry.scope}` : ''}
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

        {/* Gated flows */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '10px 0' }}>
          {entry.flows.map(flow => {
            const gatedEdges = (flow.codeEdges ?? []).filter(e => (e.flags ?? []).some(f => f.name === entry.name))
            const gatedUnits = (flow.codeUnits ?? []).filter(u => (u.flags ?? []).some(f => f.name === entry.name))
            return (
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
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#a78bfa')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#2e3250')}
              >
                <div style={{ fontWeight: 700, fontSize: 12, color: '#e2e8f0' }}>{flow.name}</div>
                {gatedUnits.map(u => (
                  <div key={u.id} style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
                    🚩 gates <code style={{ color: '#a78bfa' }}>{u.label}</code>
                  </div>
                ))}
                {gatedEdges.map((e, i) => (
                  <div key={i} style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
                    🚩 gates <code style={{ color: '#a78bfa' }}>{e.label ?? `${e.from} → ${e.to}`}</code>
                    {e.condition ? <span style={{ color: '#64748b' }}> — {e.condition}</span> : null}
                  </div>
                ))}
                <div style={{ fontSize: 10, color: '#4f6ef7', marginTop: 6 }}>View flow graph →</div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
