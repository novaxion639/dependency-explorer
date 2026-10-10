import { useCallback, useEffect, useState } from 'react'
import { monolithRoutes, resourceSurface } from '@dependency-explorer/data'
import { canGoBack, edgeKey, pagePatch, selectServicePatch, useUrlState } from '../hooks/useUrlState'
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
import { HomePage } from './HomePage'
import { MicroservicesPage } from './MicroservicesPage'
import { MonolithPage } from './MonolithPage'
import { areaSlice } from '../utils/areaSlice'
import { connectionsFor, fileIndex, flagRegistry, map, resourceIds, searchIndex } from './dataIndexes'
import { validateUrlState } from './validateUrlState'
import { keyInfo, onPresentKey } from './presentMode'


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

  const openResource = useCallback((id: string) => patch({ ...pagePatch('resources'), resource: id }), [patch])
  const selectService = useCallback((name: string) => patch(selectServicePatch(name)), [patch])
  const selectedFlow = url.flow ? map.flows.find(f => f.id === url.flow) ?? null : null
  const flagEntry = url.flag ? flagRegistry.get(url.flag) : undefined
  const fileEntry = url.file ? fileIndex.get(url.file) : undefined
  const architecture = url.page === 'microservices' || url.page === 'monolith'
  const edgeConnections = architecture && url.edge ? connectionsFor(url.edge) : []
  const [firstEdge] = edgeConnections
  const slice = architecture && url.area ? areaSlice(map, monolithRoutes, resourceSurface.resources, url.area) : null
  const unitPanel = url.page === 'flows' && selectedFlow && url.unit
    ? <UnitDetail flow={selectedFlow} id={url.unit} onOpenFlow={id => patch({ flow: id, unit: null, chapter: null })} onOpenResource={openResource} onClose={() => patch({ unit: null })} />
    : null
  const drawerService = (architecture || url.page === 'flows') && url.drawer ? map.services.find(s => s.name === url.drawer) ?? null : null
  const panel = unitPanel ?? (edgeConnections.length > 1
    ? <ConnectionList connections={edgeConnections} onOpen={c => patch({ edge: edgeKey(c.from, c.to, c.protocol) })} onClose={() => patch({ edge: null })} />
    : firstEdge
      ? <EdgeDetail connection={firstEdge} map={map} onSeeEndpoints={name => patch({ drawer: name, ep: null, edge: null })} onClose={() => patch({ edge: null })} />
      : drawerService
        ? <EndpointList serviceName={drawerService.name} endpoints={drawerService.endpoints} recurringTasks={drawerService.recurringTasks} highlightId={url.ep} onClose={() => patch({ drawer: null, ep: null })} onOpenService={() => selectService(drawerService.name)} />
        : slice
          ? <AreaSlice slice={slice} onOpenArea={id => patch({ ...pagePatch('areas'), area: id })} onOpenResource={openResource} onSelectService={selectService} onOpenFlow={id => patch({ ...pagePatch('flows'), flow: id })} onClose={() => patch({ area: null })} />
          : null)

  const content =
    url.page === 'home' ? <HomePage index={searchIndex} onNavigate={patch} />
    : url.page === 'areas' ? (url.area
      ? <AreaPage map={map} areaId={url.area} term={url.term} onBack={() => patch({ area: null, term: null })} onOpenFlow={id => patch({ page: 'flows', flow: id })} onOpenArea={id => patch({ area: id, term: null })} onSelectService={selectService} />
      : <AreasHome map={map} onOpenArea={id => patch({ area: id, term: null })} onOpenContext={() => patch({ page: 'microservices', s: null })} />)
    : url.page === 'microservices' ? <MicroservicesPage url={url} patch={patch} />
    : url.page === 'monolith' ? <MonolithPage url={url} patch={patch} />
    : url.page === 'flows' ? (selectedFlow
      ? <FlowPage flow={selectedFlow} url={url} patch={patch} onBack={() => (canGoBack(window.history.state) ? window.history.back() : patch({ flow: null, unit: null, chapter: null }))} />
      : flagEntry ? <FlagPage entry={flagEntry} onSelectFlow={flow => patch({ flow: flow.id, flag: null })} />
      : fileEntry ? <FilePage entry={fileEntry} onSelectFlow={flow => patch({ flow: flow.id, file: null, unit: (flow.codeUnits ?? []).find(u => u.service === fileEntry.service && u.path === fileEntry.path)?.id ?? null })} onOpenRoute={id => patch({ page: 'monolith', file: null, drawer: 'skello-app', ep: id })} onOpenResource={openResource} />
      : <FlowsIndex service={url.flows} flows={map.flows} map={map} onSelectFlow={flow => patch({ flow: flow.id })} />)
    : url.page === 'resources' ? (url.resource
      ? <ResourcePage id={url.resource} onOpenResource={openResource} onOpenFile={key => patch({ page: 'flows', resource: null, file: key })} onOpenFlow={id => patch({ page: 'flows', flow: id })} onSelectService={selectService} onBlast={id => patch({ page: 'impact', blast: id })} listeners={url} onListeners={patch} />
      : <ResourcesIndex onOpenResource={openResource} />)
    : url.page === 'impact' ? <ImpactPage origin={url.blast} renderer={url.renderer} onRenderer={renderer => patch({ renderer })} onPick={id => patch({ blast: id })} onSelect={node => (resourceIds.has(node) ? openResource(node) : selectService(node))} onOpenFlow={id => patch({ page: 'flows', flow: id })} />
    : <OwnershipPage map={map} focusedTeam={url.team} onFocusTeam={team => patch({ team })} onSelectService={selectService} onOpenArea={id => patch({ page: 'areas', area: id, term: null })} />

  return (
    <>
      <AppShell url={url} onNavigate={patch} onSearch={() => setSearchOpen(true)} onTogglePresent={() => patch({ present: !url.present })} panel={panel}>
        {url.notFound && <NotFoundBanner notFound={url.notFound} onDismiss={() => patch({ notFound: null })} />}
        {content}
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
    </>
  )
}
