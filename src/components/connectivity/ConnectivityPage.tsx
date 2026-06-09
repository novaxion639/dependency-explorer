import { useCallback, useMemo, useState } from 'react'
import type React from 'react'
import type { ServiceFlow } from '../../data/schemas'
import { useConnectivityMap } from '../../hooks/useConnectivityMap'
import { computeBlastRadius } from '../../utils/blastRadius'
import { ServiceSidebar } from './ServiceSidebar'
import { ConnectivityGraph } from './ConnectivityGraph'
import { DomainGraph } from './DomainGraph'
import { FlowsPanel } from './FlowsPanel'
import { FlowListModal } from './FlowListModal'
import { FlowGraphModal } from './FlowGraphModal'

type ViewMode = 'services' | 'domains'

export function ConnectivityPage() {
  const state = useConnectivityMap()
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [sidebarSearch, setSidebarSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('services')
  const [domainFilter, setDomainFilter] = useState<string | null>(null)
  const [showBlastRadius, setShowBlastRadius] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const handleSeed = useCallback(async () => {
    setSeeding(true)
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      if (!res.ok) throw new Error(`Seed failed: ${res.status}`)
      state.reload()
    } catch (err) {
      console.error(err)
    } finally {
      setSeeding(false)
    }
  }, [state.reload])

  // Flow modal state: null = closed, string = list open for service, ServiceFlow = graph open
  const [flowModalService, setFlowModalService] = useState<string | null>(null)
  const [selectedFlow, setSelectedFlow] = useState<ServiceFlow | null>(null)

  // Blast radius — must be above early returns to maintain hook order
  const map = state.status === 'ok' ? state.map : null
  const blastRadius = useMemo(() => {
    if (!map || !selectedService || !showBlastRadius) return null
    return computeBlastRadius(map, selectedService, 3)
  }, [map, selectedService, showBlastRadius])

  if (state.status === 'loading') return <Centered>Loading…</Centered>
  if (state.status === 'error') return <Centered>Failed to load: {state.message}</Centered>

  const selected = selectedService
    ? map!.services.find(s => s.name === selectedService)
    : null

  const teamById = new Map((map!.teams ?? []).map(t => [t.id, t]))
  const selectedTeam = selected?.teamId ? teamById.get(selected.teamId) : undefined

  // Count connections for selected service
  const outCount = map!.connections.filter(c => c.from === selectedService).length
  const inCount = map!.connections.filter(c => c.to === selectedService).length

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <ServiceSidebar
        services={map!.services}
        teams={map!.teams}
        domains={map!.domains}
        selected={selectedService}
        onSelect={name => { setSelectedService(name); setViewMode('services') }}
        search={sidebarSearch}
        onSearch={setSidebarSearch}
        domainFilter={domainFilter}
        onDomainFilter={setDomainFilter}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* View toggle */}
        <div style={{
          padding: '6px 16px', background: '#1a1d27', borderBottom: '1px solid #2e3250',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {(['services', 'domains'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '4px 12px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                border: 'none', cursor: 'pointer',
                background: viewMode === mode ? '#6366f1' : 'transparent',
                color: viewMode === mode ? '#fff' : '#64748b',
              }}
            >
              {mode === 'services' ? 'Service View' : 'Domain View'}
            </button>
          ))}
          <div style={{ marginLeft: 'auto' }}>
            <button
              onClick={handleSeed}
              disabled={seeding}
              style={{
                padding: '4px 12px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                border: '1px solid #2e3250', cursor: seeding ? 'wait' : 'pointer',
                background: seeding ? '#10b98122' : 'transparent',
                color: seeding ? '#10b981' : '#64748b',
                transition: 'all 0.15s',
              }}
            >
              {seeding ? 'Seeding...' : 'Seed database'}
            </button>
          </div>
        </div>

        {/* Info bar when a service is selected */}
        {selected && viewMode === 'services' && (
          <div style={{
            padding: '8px 16px', background: '#1a1d27', borderBottom: '1px solid #2e3250',
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0' }}>{selected.name}</span>
              {selectedTeam && (
                <span style={{
                  fontSize: 10, fontWeight: 600, marginLeft: 8,
                  padding: '1px 6px', borderRadius: 3,
                  background: '#6366f122', color: '#818cf8',
                }}>
                  {selectedTeam.name}
                </span>
              )}
              <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>{selected.description}</span>
              {selectedTeam?.slackChannel && (
                <span style={{ fontSize: 11, color: '#4b5563', marginLeft: 8 }}>
                  {selectedTeam.slackChannel}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', flexWrap: 'wrap', alignItems: 'center' }}>
              <Pill label="calls" count={outCount} color="#4f6ef7" />
              <Pill label="called by" count={inCount} color="#818cf8" />
              <Pill label="endpoints" count={selected.endpoints.length} color="#6366f1" />
              <button
                onClick={() => setShowBlastRadius(v => !v)}
                style={{
                  padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                  background: showBlastRadius ? '#ef444422' : '#2e3250',
                  color: showBlastRadius ? '#ef4444' : '#64748b',
                }}
              >
                {showBlastRadius
                  ? `Blast radius: ${blastRadius?.count ?? 0} services`
                  : 'Show blast radius'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#3e4363' }}>
              Click a node to explore its flows · Click an edge for endpoint details
            </div>
          </div>
        )}

        {viewMode === 'services' ? (
          <ConnectivityGraph
            map={map!}
            selectedService={selectedService}
            onSelectService={setSelectedService}
            onOpenFlows={name => {
              setFlowModalService(name)
              setSelectedFlow(null)
            }}
            blastRadius={blastRadius?.affected ?? null}
          />
        ) : (
          <DomainGraph
            map={map!}
            onSelectDomain={domainId => {
              setDomainFilter(domainId)
              setViewMode('services')
            }}
          />
        )}

        {selectedService && viewMode === 'services' && (
          <FlowsPanel
            flows={map!.flows ?? []}
            selectedService={selectedService}
            map={map!}
            onSelectService={setSelectedService}
            onOpenFlow={flow => setSelectedFlow(flow)}
          />
        )}
      </div>

      {/* Flow list modal */}
      {flowModalService && !selectedFlow && (
        <FlowListModal
          serviceName={flowModalService}
          flows={map!.flows ?? []}
          map={map!}
          onSelectFlow={flow => setSelectedFlow(flow)}
          onClose={() => setFlowModalService(null)}
        />
      )}

      {/* Flow graph modal */}
      {selectedFlow && (
        <FlowGraphModal
          flow={selectedFlow}
          map={map!}
          onBack={() => setSelectedFlow(null)}
          onClose={() => {
            setSelectedFlow(null)
            setFlowModalService(null)
          }}
        />
      )}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 14 }}>
      {children}
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
