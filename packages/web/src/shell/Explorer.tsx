import { useEffect, useState } from 'react'
import { canGoBack, edgeKey, pagePatch, resourcePatch, selectServicePatch, toQueryString, useUrlState, type UrlState } from '../hooks/useUrlState'
import { SearchModal } from '../components/SearchModal'
import { NotFoundBanner } from '../components/areas/NotFoundBanner'
import { AreasHome } from '../components/areas/AreasHome'
import { AreaPage } from '../components/areas/AreaPage'
import { AreaSlice } from '../components/areas/AreaSlice'
import { EdgeDetail } from '../components/connectivity/EdgeDetail'
import { EndpointList } from '../components/connectivity/EndpointList'
import { ConnectionList } from '../components/connectivity/ConnectionList'
import { FlowsIndex } from '../components/connectivity/FlowsIndex'
import { FlagPage } from '../components/connectivity/FlagPage'
import { FilePage } from '../components/connectivity/FilePage'
import { ResourcePage } from '../components/resources/ResourcePage'
import { ResourcesIndex } from '../components/resources/ResourcesIndex'
import { ImpactPage } from '../components/resources/ImpactPage'
import { OwnershipPage } from '../components/ownership/OwnershipPage'
import { FlowPage } from '../components/flows/FlowPage'
import { UnitDetail } from '../components/flows/UnitDetail'
import { AppShell } from './AppShell'
import { NavContext } from './NavLink'
import { PageErrorBoundary } from './PageErrorBoundary'
import { HomePage } from './HomePage'
import { MicroservicesPage } from './MicroservicesPage'
import { MonolithPage } from './MonolithPage'
import { fileIndex, flagRegistry, map, resourceIds, searchIndex } from './dataIndexes'
import { panelFor, type Panel } from './panelFor'
import { validateUrlState } from './validateUrlState'
import { keyInfo, onPresentKey } from './presentMode'

type Patch = (p: Partial<UrlState>) => void

function PanelView({ panel, patch }: { panel: Panel; patch: Patch }) {
  switch (panel.kind) {
    case 'unit':
      return <UnitDetail flow={panel.flow} id={panel.unit} onClose={() => patch({ unit: null })} />
    case 'connections':
      return <ConnectionList connections={panel.connections} onOpen={c => patch({ edge: edgeKey(c.from, c.to, c.protocol) })} onClose={() => patch({ edge: null })} />
    case 'edge':
      return <EdgeDetail connection={panel.connection} map={map} onSeeEndpoints={name => patch({ drawer: name, ep: null, edge: null })} onClose={() => patch({ edge: null })} />
    case 'endpoints':
      return <EndpointList key={panel.service.name} serviceName={panel.service.name} endpoints={panel.service.endpoints} recurringTasks={panel.service.recurringTasks} highlightId={panel.highlight} onClose={() => patch({ drawer: null, ep: null })} onOpenService={() => patch(selectServicePatch(panel.service.name))} />
    case 'slice':
      return <AreaSlice slice={panel.slice} onOpenArea={id => patch({ ...pagePatch('areas'), area: id })} onClose={() => patch({ area: null })} />
    case 'none':
      return null
  }
}

function FlowsContent({ url, patch }: { url: UrlState; patch: Patch }) {
  const flow = url.flow ? map.flows.find(f => f.id === url.flow) : undefined
  if (flow) {
    return <FlowPage flow={flow} url={url} patch={patch} onBack={() => (canGoBack(window.history.state) ? window.history.back() : patch({ flow: null, unit: null, chapter: null }))} />
  }
  const flag = url.flag ? flagRegistry.get(url.flag) : undefined
  if (flag) {
    return <FlagPage entry={flag} />
  }
  const file = url.file ? fileIndex.get(url.file) : undefined
  if (file) {
    return <FilePage entry={file} />
  }
  return <FlowsIndex service={url.flows} flows={map.flows} map={map} />
}

function PageContent({ url, patch }: { url: UrlState; patch: Patch }) {
  const selectService = (name: string) => patch(selectServicePatch(name))
  switch (url.page) {
    case 'home':
      return <HomePage index={searchIndex} />
    case 'areas':
      return url.area
        ? <AreaPage map={map} areaId={url.area} term={url.term} onBack={() => patch({ area: null, term: null })} onOpenArea={id => patch({ area: id, term: null })} onSelectService={selectService} />
        : <AreasHome map={map} onOpenContext={() => patch({ page: 'microservices', s: null })} />
    case 'microservices':
      return <MicroservicesPage url={url} patch={patch} />
    case 'monolith':
      return <MonolithPage url={url} patch={patch} />
    case 'flows':
      return <FlowsContent url={url} patch={patch} />
    case 'resources':
      return url.resource
        ? <ResourcePage id={url.resource} onBlast={id => patch({ page: 'impact', blast: id })} listeners={url} onListeners={patch} />
        : <ResourcesIndex url={url} patch={patch} />
    case 'impact':
      return <ImpactPage origin={url.blast} renderer={url.renderer} onRenderer={renderer => patch({ renderer })} onPick={id => patch({ blast: id })} onSelect={node => patch(resourceIds.has(node) ? resourcePatch(node) : selectServicePatch(node))} />
    case 'ownership':
      return <OwnershipPage map={map} focusedTeam={url.team} onFocusTeam={team => patch({ team })} onSelectService={selectService} />
  }
}

export function Explorer() {
  const [url, patch] = useUrlState(validateUrlState)
  const [searchOpen, setSearchOpen] = useState(false)

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      onPresentKey({ ...keyInfo(e), stopPropagation: () => e.stopPropagation() }, url.present, patch)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [patch, url.present])

  const panel = panelFor(url)
  const resetKey = toQueryString(url)
  const goHome = () => patch(pagePatch('home'))
  const guardedPanel = panel.kind === 'none' ? null : <PageErrorBoundary resetKey={resetKey} onHome={goHome}><PanelView panel={panel} patch={patch} /></PageErrorBoundary>

  return (
    <NavContext value={{ url, onNavigate: patch }}>
      <AppShell url={url} onSearch={() => setSearchOpen(true)} onTogglePresent={() => patch({ present: !url.present })} panel={guardedPanel}>
        {url.notFound && <NotFoundBanner notFound={url.notFound} onDismiss={() => patch({ notFound: null })} />}
        <PageErrorBoundary resetKey={resetKey} onHome={goHome}><PageContent url={url} patch={patch} /></PageErrorBoundary>
      </AppShell>
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
    </NavContext>
  )
}
