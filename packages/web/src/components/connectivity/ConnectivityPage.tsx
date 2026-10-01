import { useCallback, useEffect, useMemo, useState } from 'react'
import { connectivityMap, monolithRoutes } from '@dependency-explorer/data'
import { computeBlastRadius } from '../../utils/blastRadius'
import { buildSearchIndex } from '../../utils/searchIndex'
import { useUrlState, edgeKey, EDGE_SEP } from '../../hooks/useUrlState'
import type { UrlState } from '../../hooks/useUrlState'
import { SearchModal } from '../SearchModal'
import { ServiceSidebar } from './ServiceSidebar'
import { ConnectivityGraph } from './ConnectivityGraph'
import { FlowsPanel } from './FlowsPanel'
import { FlowListModal } from './FlowListModal'
import { FlowGraphModal } from './FlowGraphModal'
import { FlagModal } from './FlagModal'
import { FileModal } from './FileModal'
import { OwnershipPage } from '../ownership/OwnershipPage'
import { AreasHome } from '../areas/AreasHome'
import { AreaPage } from '../areas/AreaPage'
import { SystemContext } from '../areas/SystemContext'
import { NotFoundBanner } from '../areas/NotFoundBanner'
import { buildFlagRegistry } from '../../utils/flagRegistry'
import { buildFileIndex } from '../../utils/fileIndex'
import { CLAMP_TWO_LINES } from '../../utils/clamp'

const map = connectivityMap
const searchIndex = buildSearchIndex(map, monolithRoutes)
const flagRegistry = buildFlagRegistry(map)
const fileIndex = buildFileIndex(map, monolithRoutes)
const areaById = new Map((map.areas ?? []).map(a => [a.id, a]))

// Strip URL params that don't resolve against the dataset, so a stale shared
// link (renamed service, retired flow) degrades to the nearest valid view; the
// first unresolved area/term/flow/service is surfaced as a not-found banner.
function validateUrlState(st: UrlState): UrlState {
  const serviceNames = new Set(map.services.map(s => s.name))
  const next = { ...st }
  let notFound: UrlState['notFound'] = null
  if (next.s && !serviceNames.has(next.s)) {
    notFound = { param: 's', value: next.s }
    next.s = null
  }
  if (next.area && !areaById.has(next.area)) {
    notFound = notFound ?? { param: 'area', value: next.area }
    next.area = null
  }
  if (next.term && !areaById.get(next.area ?? '')?.glossary.some(g => g.term === next.term)) {
    notFound = notFound ?? { param: 'term', value: next.term }
    next.term = null
  }
  if (next.flow && !map.flows.some(f => f.id === next.flow)) {
    notFound = notFound ?? { param: 'flow', value: next.flow }
    next.flow = null
  }
  if (next.team && !(map.teams ?? []).some(t => t.id === next.team)) next.team = null
  if (next.flows && !serviceNames.has(next.flows)) next.flows = null
  if (next.flag && !flagRegistry.has(next.flag)) next.flag = null
  if (next.file && !fileIndex.has(next.file)) next.file = null
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
  next.notFound = notFound
  return next
}

export function ConnectivityPage() {
  const [url, patch] = useUrlState(validateUrlState)
  const [sidebarSearch, setSidebarSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const selectedService = url.s
  const viewMode = url.view
  const showBlastRadius = url.blast

  const selectService = useCallback(
    (name: string) => {
      setSidebarOpen(false)
      patch({ s: name, view: 'services', edge: null, drawer: null, ep: null })
    },
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
        selected={selectedService}
        onSelect={selectService}
        search={sidebarSearch}
        onSearch={setSidebarSearch}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* View toggle */}
        <div className="toolbar" style={{
          padding: '6px 16px', background: '#1a1d27', borderBottom: '1px solid #2e3250',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <button type="button" className="mobile-only" onClick={() => setSidebarOpen(true)} aria-label="Open services menu" style={{ background: 'transparent', border: '1px solid #2e3250', color: '#94a3b8', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>☰</button>
          {(['areas', 'context', 'services', 'teams'] as const).map(mode => (
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
              {VIEW_LABEL[mode]}
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

        {url.notFound && <NotFoundBanner notFound={url.notFound} onDismiss={() => patch({ notFound: null })} />}

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
              <span title={selected.description} style={{ fontSize: 12, color: '#64748b', marginTop: 2, ...CLAMP_TWO_LINES }}>{selected.description}</span>
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

        {viewMode === 'areas' && url.area ? (
          <AreaPage
            map={map}
            areaId={url.area}
            term={url.term}
            onBack={() => patch({ area: null, term: null })}
            onOpenFlow={id => patch({ flow: id })}
            onOpenArea={id => patch({ area: id, term: null })}
            onSelectService={selectService}
          />
        ) : viewMode === 'areas' ? (
          <AreasHome map={map} onOpenArea={id => patch({ area: id, term: null })} onOpenContext={() => patch({ view: 'context' })} />
        ) : viewMode === 'context' ? (
          <SystemContext map={map} onSelectService={selectService} onOpenArea={id => patch({ view: 'areas', area: id, term: null })} />
        ) : viewMode === 'services' ? (
          <ConnectivityGraph
            map={map}
            selectedService={selectedService}
            onSelectService={selectService}
            onOpenFlows={name => patch({ flows: name, flow: null })}
            blastRadius={blastRadius?.affected ?? null}
            edgeConnection={edgeConnection}
            onEdgeSelect={conn => patch({ edge: conn ? edgeKey(conn.from, conn.to, conn.protocol) : null })}
            drawerService={drawerService}
            onDrawerSelect={name => patch({ drawer: name, ep: null })}
            highlightEndpointId={url.ep}
          />
        ) : (
          <OwnershipPage
            map={map}
            focusedTeam={url.team}
            onFocusTeam={team => patch({ team })}
            onSelectService={selectService}
            onOpenArea={id => patch({ view: 'areas', area: id, term: null })}
          />
        )}

        {selectedService && viewMode === 'services' && (
          <FlowsPanel
            flows={map.flows ?? []}
            selectedService={selectedService}
            map={map}
            onSelectService={selectService}
            onOpenFlow={flow => patch({ flow: flow.id })}
          />
        )}
      </div>

      {/* Flow list modal */}
      {url.flows && !selectedFlow && (
        <FlowListModal
          serviceName={url.flows}
          flows={map.flows ?? []}
          map={map}
          onSelectFlow={flow => patch({ flow: flow.id })}
          onClose={() => patch({ flows: null })}
        />
      )}

      {/* Flow graph modal */}
      {selectedFlow && (
        <FlowGraphModal
          flow={selectedFlow}
          map={map}
          detail={url.detail}
          onDetailChange={d => patch({ detail: d })}
          onOpenFlow={flowId => patch({ flow: flowId, detail: null })}
          onOpenArea={id => patch({ view: 'areas', area: id, term: null, flow: null, flows: null, detail: null })}
          onBack={() => patch({ flow: null, detail: null })}
          onClose={() => patch({ flow: null, flows: null, detail: null })}
        />
      )}

      {/* Feature-flag view (?flag=…) */}
      {url.flag && !selectedFlow && flagRegistry.get(url.flag) && (
        <FlagModal
          entry={flagRegistry.get(url.flag)!}
          onSelectFlow={flow => patch({ flow: flow.id, flag: null })}
          onClose={() => patch({ flag: null })}
        />
      )}

      {/* Reverse code→flows view (?file=…) */}
      {url.file && !selectedFlow && fileIndex.get(url.file) && (
        <FileModal
          entry={fileIndex.get(url.file)!}
          onSelectFlow={flow => patch({ flow: flow.id, detail: 'code', file: null })}
          onOpenRoute={id => patch({ file: null, s: 'skello-app', view: 'services', drawer: 'skello-app', ep: id })}
          onClose={() => patch({ file: null })}
        />
      )}

      {/* Global search (⌘K) */}
      {searchOpen && (
        <SearchModal
          index={searchIndex}
          onNavigate={p => {
            patch(p)
            setSearchOpen(false)
          }}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  )
}

const VIEW_LABEL = { areas: 'Areas', context: 'System context', services: 'Service View', teams: 'Ownership' } as const

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
