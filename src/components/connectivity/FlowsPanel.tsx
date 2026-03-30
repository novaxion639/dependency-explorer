import { useState } from 'react'
import type { ServiceFlow, ConnectivityMap } from '../../types-connectivity'
import { DB_COLORS } from '../nodes/DatabaseNode'

const TYPE_COLOR: Record<string, string> = {
  'typescript-microservice': '#3178c6',
  'rails-microservice': '#cc342d',
  'rails-monolith': '#cc342d',
  'vue-frontend': '#42b883',
  'react-native': '#61dafb',
}

interface Props {
  flows: ServiceFlow[]
  selectedService: string
  map: ConnectivityMap
  onSelectService: (name: string) => void
  onOpenFlow: (flow: ServiceFlow) => void
}

export function FlowsPanel({ flows, selectedService, map, onSelectService, onOpenFlow }: Props) {
  const relevant = flows.filter(f =>
    f.steps.some(s => s.from === selectedService || s.to === selectedService),
  )

  if (relevant.length === 0) return null

  return (
    <div style={{
      borderTop: '1px solid #2e3250',
      background: '#13151f',
      padding: '10px 16px',
      flexShrink: 0,
      maxHeight: 220,
      overflowY: 'auto',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#3e4363', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        Request flows
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {relevant.map(flow => (
          <FlowCard
            key={flow.id}
            flow={flow}
            selectedService={selectedService}
            map={map}
            onSelectService={onSelectService}
            onOpen={() => onOpenFlow(flow)}
          />
        ))}
      </div>
    </div>
  )
}

function FlowCard({ flow, selectedService, map, onSelectService, onOpen }: {
  flow: ServiceFlow
  selectedService: string
  map: ConnectivityMap
  onSelectService: (name: string) => void
  onOpen: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  // Deduplicate services in step order, preserving first appearance
  const stepServices: string[] = []
  for (const step of flow.steps) {
    if (!stepServices.includes(step.from)) stepServices.push(step.from)
    if (!stepServices.includes(step.to)) stepServices.push(step.to)
  }

  return (
    <div
      onClick={onOpen}
      style={{
        background: '#1a1d27',
        border: '1px solid #2e3250',
        borderRadius: 6,
        padding: '8px 12px',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#6366f1')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#2e3250')}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>{flow.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 8 }}>
          {flow.description && (
            <button
              onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
              title={expanded ? 'Hide description' : 'Show description'}
              style={{
                background: 'none', border: 'none', padding: '0 2px',
                cursor: 'pointer', color: '#3e4363', fontSize: 11, lineHeight: 1,
                display: 'flex', alignItems: 'center',
              }}
            >
              {expanded ? '▴' : '▾'}
            </button>
          )}
          <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 600 }}>View graph →</span>
        </div>
      </div>

      {/* Step chain */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
        {stepServices.map((name, i) => {
          const svc = map.services.find(s => s.name === name)
          const color = TYPE_COLOR[svc?.type ?? ''] ?? '#64748b'
          const isSelected = name === selectedService
          return (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {i > 0 && (
                <span style={{ color: '#3e4363', fontSize: 12 }}>→</span>
              )}
              <button
                onClick={e => { e.stopPropagation(); onSelectService(name) }}
                title={flow.steps.find(s => s.from === name || s.to === name)?.action}
                style={{
                  background: isSelected ? color + '22' : 'transparent',
                  border: `1px solid ${isSelected ? color : '#2e3250'}`,
                  borderRadius: 4,
                  padding: '2px 7px',
                  cursor: 'pointer',
                  fontSize: 11,
                  color: isSelected ? color : '#64748b',
                  fontWeight: isSelected ? 700 : 400,
                  transition: 'all 0.1s',
                  whiteSpace: 'nowrap',
                }}
              >
                {name}
              </button>
            </div>
          )
        })}
      </div>

      {/* Infra badges */}
      {(flow.infraNodes ?? []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {(flow.infraNodes ?? []).map(infra => {
            const meta = DB_COLORS[infra.type] ?? { color: '#64748b', icon: '💾', label: infra.type }
            return (
              <span key={infra.id} title={infra.description} style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 9, padding: '1px 5px', borderRadius: 3,
                background: meta.color + '14', border: `1px solid ${meta.color}33`,
                color: meta.color,
              }}>
                {meta.icon} {infra.label}
              </span>
            )
          })}
        </div>
      )}

      {expanded && flow.description && (
        <div style={{ fontSize: 10, color: '#64748b', marginTop: 6, lineHeight: 1.5 }}>{flow.description}</div>
      )}
    </div>
  )
}
