import type { ServiceFlow, ConnectivityMap, Domain } from '../../data/schemas'
import { DB_COLORS } from '../nodes/DatabaseNode'

const TYPE_COLOR: Record<string, string> = {
  'typescript-microservice': '#3178c6',
  'rails-microservice':      '#cc342d',
  'rails-monolith':          '#cc342d',
  'vue-frontend':            '#42b883',
  'react-native':            '#61dafb',
}

function getFlowDomains(flow: ServiceFlow, domains: Domain[]): Domain[] {
  const serviceNames = new Set<string>()
  for (const step of flow.steps) {
    serviceNames.add(step.from)
    serviceNames.add(step.to)
  }
  return domains.filter(d => d.serviceNames.some(s => serviceNames.has(s)))
}

interface Props {
  serviceName: string
  flows: ServiceFlow[]
  map: ConnectivityMap
  onSelectFlow: (flow: ServiceFlow) => void
  onClose: () => void
}

export function FlowListModal({ serviceName, flows, map, onSelectFlow, onClose }: Props) {
  const relevant = flows.filter(f =>
    f.steps.some(s => s.from === serviceName || s.to === serviceName),
  )

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
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>
              Request Flows
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              <span style={{ color: '#818cf8' }}>{serviceName}</span>
              {' '}is involved in {relevant.length} flow{relevant.length !== 1 ? 's' : ''}
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

        {/* Flow list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '10px 0' }}>
          {relevant.length === 0 ? (
            <div style={{ padding: '24px', fontSize: 13, color: '#64748b', textAlign: 'center' }}>
              No flows found for this service.
            </div>
          ) : (
            relevant.map(flow => (
              <FlowCard
                key={flow.id}
                flow={flow}
                serviceName={serviceName}
                map={map}
                onSelect={() => onSelectFlow(flow)}
              />
            ))
          )}
        </div>
      </div>
    </>
  )
}

function FlowCard({ flow, serviceName, map, onSelect }: {
  flow: ServiceFlow
  serviceName: string
  map: ConnectivityMap
  onSelect: () => void
}) {
  const stepServices: string[] = []
  for (const step of flow.steps) {
    if (!stepServices.includes(step.from)) stepServices.push(step.from)
    if (!stepServices.includes(step.to))   stepServices.push(step.to)
  }

  const flowDomains = getFlowDomains(flow, map.domains ?? [])

  return (
    <div
      style={{
        margin: '0 12px 8px',
        background: '#13151f',
        border: '1px solid #2e3250',
        borderRadius: 8,
        overflow: 'hidden',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#4f6ef7')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#2e3250')}
    >
      {/* Card header */}
      <div style={{ padding: '10px 14px 6px', background: '#1a1d27' }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: '#e2e8f0' }}>{flow.name}</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{flow.description}</div>
      </div>

      {/* Domain badges */}
      {flowDomains.length > 0 && (
        <div style={{ padding: '4px 14px 2px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {flowDomains.map(d => (
            <span key={d.id} style={{
              fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 3,
              background: d.color + '18', border: `1px solid ${d.color}33`, color: d.color,
            }}>
              {d.name}
            </span>
          ))}
        </div>
      )}

      {/* Service chain */}
      <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
        {stepServices.map((name, i) => {
          const svc = map.services.find(s => s.name === name)
          const color = TYPE_COLOR[svc?.type ?? ''] ?? '#64748b'
          const isHighlighted = name === serviceName
          return (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {i > 0 && <span style={{ color: '#3e4363', fontSize: 11 }}>→</span>}
              <span style={{
                fontSize: 10,
                padding: '2px 7px', borderRadius: 4,
                background: isHighlighted ? color + '22' : 'transparent',
                border: `1px solid ${isHighlighted ? color : '#2e3250'}`,
                color: isHighlighted ? color : '#64748b',
                fontWeight: isHighlighted ? 700 : 400,
                whiteSpace: 'nowrap',
              }}>
                {name}
              </span>
            </div>
          )
        })}
      </div>

      {/* Infra icons */}
      {(flow.infraNodes ?? []).length > 0 && (
        <div style={{ padding: '0 14px 8px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {(flow.infraNodes ?? []).map(infra => {
            const meta = DB_COLORS[infra.type] ?? { color: '#64748b', icon: '💾', label: infra.type }
            const cruds = (flow.infraEdges ?? [])
              .filter(e => e.to === infra.id && e.crud?.length)
              .flatMap(e => e.crud!)
            const uniqueCruds = [...new Set(cruds)]
            const crudLabel = uniqueCruds.length ? uniqueCruds.map(c => c[0]!.toUpperCase()).join('') : ''
            return (
              <span
                key={infra.id}
                title={infra.description}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  fontSize: 10, padding: '2px 6px', borderRadius: 4,
                  background: meta.color + '14', border: `1px solid ${meta.color}33`,
                  color: meta.color,
                }}
              >
                <span>{meta.icon}</span>
                <span style={{ fontWeight: 600 }}>{meta.label}</span>
                <span style={{ opacity: 0.7 }}>{infra.label}</span>
                {crudLabel && <span style={{ fontWeight: 700, fontSize: 9, opacity: 0.8 }}>[{crudLabel}]</span>}
              </span>
            )
          })}
        </div>
      )}

      {/* CTA */}
      <div style={{ padding: '8px 14px', borderTop: '1px solid #1e2235' }}>
        <button
          onClick={onSelect}
          style={{
            width: '100%', padding: '7px', borderRadius: 6,
            background: '#6366f1', border: 'none', color: '#fff',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#4f46e5')}
          onMouseLeave={e => (e.currentTarget.style.background = '#6366f1')}
        >
          View flow graph →
        </button>
      </div>
    </div>
  )
}
