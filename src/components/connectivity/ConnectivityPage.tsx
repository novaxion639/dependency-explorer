import { useState } from 'react'
import rawMap from '../../data/connectivity-map.json'
import type { ConnectivityMap } from '../../types-connectivity'
import { ServiceSidebar } from './ServiceSidebar'
import { ConnectivityGraph } from './ConnectivityGraph'
import { FlowsPanel } from './FlowsPanel'

const map = rawMap as unknown as ConnectivityMap

export function ConnectivityPage() {
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [sidebarSearch, setSidebarSearch] = useState('')

  const selected = selectedService
    ? map.services.find(s => s.name === selectedService)
    : null

  // Count connections for selected service
  const outCount = map.connections.filter(c => c.from === selectedService).length
  const inCount = map.connections.filter(c => c.to === selectedService).length

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <ServiceSidebar
        services={map.services}
        selected={selectedService}
        onSelect={setSelectedService}
        search={sidebarSearch}
        onSearch={setSidebarSearch}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Info bar when a service is selected */}
        {selected && (
          <div style={{
            padding: '8px 16px', background: '#1a1d27', borderBottom: '1px solid #2e3250',
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0' }}>{selected.name}</span>
              <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>{selected.description}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', flexWrap: 'wrap' }}>
              <Pill label="calls" count={outCount} color="#4f6ef7" />
              <Pill label="called by" count={inCount} color="#818cf8" />
              <Pill label="endpoints" count={selected.endpoints.length} color="#6366f1" />
            </div>
            <div style={{ fontSize: 11, color: '#3e4363' }}>
              Click an edge to see endpoint details
            </div>
          </div>
        )}

        <ConnectivityGraph
          map={map}
          selectedService={selectedService}
          onSelectService={setSelectedService}
        />

        {selectedService && (
          <FlowsPanel
            flows={map.flows ?? []}
            selectedService={selectedService}
            map={map}
            onSelectService={setSelectedService}
          />
        )}
      </div>
    </div>
  )
}

function Pill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{ fontSize: 16, fontWeight: 700, color }}>{count}</span>
      <span style={{ fontSize: 11, color: '#64748b' }}>{label}</span>
    </div>
  )
}
