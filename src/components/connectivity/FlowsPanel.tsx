import type { ServiceFlow, ConnectivityMap } from '../../types-connectivity'

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
}

export function FlowsPanel({ flows, selectedService, map, onSelectService }: Props) {
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
          />
        ))}
      </div>
    </div>
  )
}

function FlowCard({ flow, selectedService, map, onSelectService }: {
  flow: ServiceFlow
  selectedService: string
  map: ConnectivityMap
  onSelectService: (name: string) => void
}) {
  // Deduplicate services in step order, preserving first appearance
  const stepServices: string[] = []
  for (const step of flow.steps) {
    if (!stepServices.includes(step.from)) stepServices.push(step.from)
    if (!stepServices.includes(step.to)) stepServices.push(step.to)
  }

  return (
    <div style={{
      background: '#1a1d27',
      border: '1px solid #2e3250',
      borderRadius: 6,
      padding: '8px 12px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
        {flow.name}
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
                onClick={() => onSelectService(name)}
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

      <div style={{ fontSize: 10, color: '#3e4363', marginTop: 5 }}>{flow.description}</div>
    </div>
  )
}
