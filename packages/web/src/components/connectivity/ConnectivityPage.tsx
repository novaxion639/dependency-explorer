import { useCallback, useEffect, useMemo, useState } from 'react'
import { connectivityMap } from '@dependency-explorer/data'
import { computeBlastRadius } from '../../utils/blastRadius'
import { buildSearchIndex } from '../../utils/searchIndex'
import { useUrlState, edgeKey, EDGE_SEP } from '../../hooks/useUrlState'
import type { UrlState } from '../../hooks/useUrlState'
import { SearchModal } from '../SearchModal'
import { ServiceSidebar } from './ServiceSidebar'
import { ConnectivityGraph } from './ConnectivityGraph'
import { DomainGraph } from './DomainGraph'
import { FlowsPanel } from './FlowsPanel'
import { FlowListModal } from './FlowListModal'
import { FlowGraphModal } from './FlowGraphModal'

const map = connectivityMap
const searchIndex = buildSearchIndex(map)

// Strip URL params that don't resolve against the dataset, so a stale shared
// link (renamed service, retired flow) degrades gracefully instead of
// rendering a broken view.
function validateUrlState(st: UrlState): UrlState {
  const serviceNames = new Set(map.services.map(s => s.name))
  const next = { ...st }
  if (next.s && !serviceNames.has(next.s)) next.s = null
  if (next.domain && !(map.domains ?? []).some(d => d.id === next.domain)) next.domain = null
  if (next.flows && !serviceNames.has(next.flows)) next.flows = null
  if (next.flow && !(map.flows ?? []).some(f => f.id === next.flow)) next.flow = null
  if (!next.flow) next.detail = null
  if (next.drawer && !serviceNames.has(next.drawer)) next.drawer = null
  if (next.edge) {
    const [from, to, protocol] = next.edge.split(EDGE_SEP)
    if (!map.connections.some(c => c.from === from && c.to === to && c.protocol === protocol)) {
      next.edge = null
    }
  }
  if (next.ep) {
    const drawerSvc = next.drawer ? map.services.find(s => s.name === next.drawer) : null
    if (!drawerSvc?.endpoints.some(e => e.id === next.ep)) next.ep = null
  }
  if (!next.s) next.blast = false
  return next
}

export function ConnectivityPage() {
  const [url, patch] = useUrlState(validateUrlState)
  const [sidebarSearch, setSidebarSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)

  const selectedService = url.s
  const viewMode = url.view
  const showBlastRadius = url.blast

  const selectService = useCallback(
    (name: string) => patch({ s: name, view: 'services', edge: null, drawer: null, ep: null }, { push: true }),
    [patch],
  )

  // ⌘K / Ctrl+K opens the global search from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(open => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const blastRadius = useMemo(() => {
    if (!selectedService || !showBlastRadius) return null
    return computeBlastRadius(map, selectedService, 3)
  }, [selectedService, showBlastRadius])

  const selected = selectedService
    ? map.services.find(s => s.name === selectedService)
    : null

  const selectedFlow = url.flow ? (map.flows ?? []).find(f => f.id === url.flow) ?? null : null

  const edgeConnection = useMemo(() => {
    if (!url.edge) return null
    const [from, to, protocol] = url.edge.split(EDGE_SEP)
    return map.connections.find(c => c.from === from && c.to === to && c.protocol === protocol) ?? null
  }, [url.edge])

  const drawerService = url.drawer ? map.services.find(s => s.name === url.drawer) ?? null : null

  const teamById = new Map((map.teams ?? []).map(t => [t.id, t]))
  const selectedTeam = selected?.teamId ? teamById.get(selected.teamId) : undefined

  // Count connections for selected service
  const outCount = map.connections.filter(c => c.from === selectedService).length
  const inCount = map.connections.filter(c => c.to === selectedService).length

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <ServiceSidebar
        services={map.services}
        teams={map.teams}
        domains={map.domains}
        selected={selectedService}
        onSelect={selectService}
        search={sidebarSearch}
        onSearch={setSidebarSearch}
        domainFilter={url.domain}
        onDomainFilter={d => patch({ domain: d })}
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
              onClick={() => patch({ view: mode })}
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
          <button
            onClick={() => setSearchOpen(true)}
            title="Global search (⌘K / Ctrl+K)"
            style={{
              marginLeft: 'auto', padding: '4px 12px', borderRadius: 5,
              fontSize: 11, fontWeight: 600, border: '1px solid #2e3250',
              cursor: 'pointer', background: 'transparent', color: '#64748b',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span>Search</span>
            <kbd style={{
              fontSize: 9, padding: '1px 5px', borderRadius: 3,
              background: '#2e3250', color: '#94a3b8', border: 'none', fontFamily: 'inherit',
            }}>
              ⌘K
            </kbd>
          </button>
          <CopyPermalinkButton />
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
              {selected.repoUrl && (
                <a
                  href={selected.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 11, color: '#818cf8', marginLeft: 8, textDecoration: 'none' }}
                >
                  repo ↗
                </a>
              )}
              {selected.provenance?.source === 'discovered' && (
                <span
                  title={selected.provenance.evidence}
                  style={{
                    fontSize: 10, fontWeight: 600, marginLeft: 8,
                    padding: '1px 6px', borderRadius: 3,
                    background: '#10b98122', color: '#10b981',
                  }}
                >
                  ✓ scanned {selected.provenance.lastVerified}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', flexWrap: 'wrap', alignItems: 'center' }}>
              <Pill label="calls" count={outCount} color="#4f6ef7" />
              <Pill label="called by" count={inCount} color="#818cf8" />
              <Pill label="endpoints" count={selected.endpoints.length} color="#6366f1" />
              <button
                onClick={() => patch({ blast: !showBlastRadius })}
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
            map={map}
            selectedService={selectedService}
            onSelectService={selectService}
            onOpenFlows={name => patch({ flows: name, flow: null }, { push: true })}
            blastRadius={blastRadius?.affected ?? null}
            edgeConnection={edgeConnection}
            onEdgeSelect={conn => patch({ edge: conn ? edgeKey(conn.from, conn.to, conn.protocol) : null })}
            drawerService={drawerService}
            onDrawerSelect={name => patch({ drawer: name, ep: null })}
            highlightEndpointId={url.ep}
          />
        ) : (
          <DomainGraph
            map={map}
            onSelectDomain={domainId => patch({ domain: domainId, view: 'services' })}
          />
        )}

        {selectedService && viewMode === 'services' && (
          <FlowsPanel
            flows={map.flows ?? []}
            selectedService={selectedService}
            map={map}
            onSelectService={selectService}
            onOpenFlow={flow => patch({ flow: flow.id }, { push: true })}
          />
        )}
      </div>

      {/* Flow list modal */}
      {url.flows && !selectedFlow && (
        <FlowListModal
          serviceName={url.flows}
          flows={map.flows ?? []}
          map={map}
          onSelectFlow={flow => patch({ flow: flow.id }, { push: true })}
          onClose={() => patch({ flows: null })}
        />
      )}

      {/* Flow graph modal */}
      {selectedFlow && (
        <FlowGraphModal
          flow={selectedFlow}
          map={map}
          detail={url.detail === 'code'}
          onDetailChange={d => patch({ detail: d ? 'code' : null })}
          onBack={() => patch({ flow: null, detail: null })}
          onClose={() => patch({ flow: null, flows: null, detail: null })}
        />
      )}

      {/* Global search (⌘K) */}
      {searchOpen && (
        <SearchModal
          index={searchIndex}
          onNavigate={p => {
            patch(p, { push: true })
            setSearchOpen(false)
          }}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  )
}

function CopyPermalinkButton() {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(window.location.href).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
      title="Copy a shareable link to the current view"
      style={{
        padding: '4px 12px', borderRadius: 5,
        fontSize: 11, fontWeight: 600, border: '1px solid #2e3250',
        cursor: 'pointer', background: copied ? '#10b98122' : 'transparent',
        color: copied ? '#10b981' : '#64748b',
      }}
    >
      {copied ? '✓ Copied' : '⧉ Permalink'}
    </button>
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
