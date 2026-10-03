import { useCallback, useEffect, useState } from 'react'
import { edgeKey, selectServicePatch, useUrlState } from '../hooks/useUrlState'
import { SearchModal } from '../components/SearchModal'
import { NotFoundBanner } from '../components/areas/NotFoundBanner'
import { AreasHome } from '../components/areas/AreasHome'
import { AreaPage } from '../components/areas/AreaPage'
import { FlowView } from '../components/connectivity/FlowGraphModal'
import { EdgeDetail } from '../components/connectivity/EdgeDetail'
import { EndpointList } from '../components/connectivity/EndpointList'
import { FlowsIndex } from '../components/connectivity/FlowsIndex'
import { FlagPage } from '../components/connectivity/FlagPage'
import { FilePage } from '../components/connectivity/FilePage'
import { ResourcePage } from '../components/resources/ResourcePage'
import { ResourcesIndex } from '../components/resources/ResourcesIndex'
import { ImpactPage } from '../components/resources/ImpactPage'
import { OwnershipPage } from '../components/ownership/OwnershipPage'
import { AppShell } from './AppShell'
import { HomePage } from './HomePage'
import { MicroservicesPage } from './MicroservicesPage'
import { fileIndex, flagRegistry, map, resourceIds, searchIndex } from './dataIndexes'
import { validateUrlState } from './validateUrlState'


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

  const openResource = useCallback((id: string) => patch({ page: 'resources', flow: null, detail: null, file: null, resource: id }), [patch])
  const selectService = useCallback((name: string) => patch(selectServicePatch(name)), [patch])
  const selectedFlow = url.flow ? map.flows.find(f => f.id === url.flow) ?? null : null
  const flagEntry = url.flag ? flagRegistry.get(url.flag) : undefined
  const fileEntry = url.file ? fileIndex.get(url.file) : undefined
  const architecture = url.page === 'microservices' || url.page === 'monolith'
  const edgeConnection = architecture && url.edge ? map.connections.find(c => edgeKey(c.from, c.to, c.protocol) === url.edge) ?? null : null
  const drawerService = architecture && url.drawer ? map.services.find(s => s.name === url.drawer) ?? null : null
  const panel = edgeConnection
    ? <EdgeDetail connection={edgeConnection} map={map} onSeeEndpoints={name => patch({ drawer: name, ep: null, edge: null })} onClose={() => patch({ edge: null })} />
    : drawerService
      ? <EndpointList serviceName={drawerService.name} endpoints={drawerService.endpoints} recurringTasks={drawerService.recurringTasks} highlightId={url.ep} onClose={() => patch({ drawer: null, ep: null })} />
      : null

  const content =
    url.page === 'home' ? <HomePage index={searchIndex} onNavigate={patch} />
    : url.page === 'areas' ? (url.area
      ? <AreaPage map={map} areaId={url.area} term={url.term} onBack={() => patch({ area: null, term: null })} onOpenFlow={id => patch({ page: 'flows', flow: id })} onOpenArea={id => patch({ area: id, term: null })} onSelectService={selectService} />
      : <AreasHome map={map} onOpenArea={id => patch({ area: id, term: null })} onOpenContext={() => patch({ page: 'microservices', s: null })} />)
    : url.page === 'microservices' || url.page === 'monolith' ? <MicroservicesPage url={url.page === 'monolith' ? { ...url, s: 'skello-app' } : url} patch={patch} onOpenResource={openResource} />
    : url.page === 'flows' ? (selectedFlow
      ? <FlowView flow={selectedFlow} map={map} detail={url.detail} onDetailChange={d => patch({ detail: d })} onOpenFlow={id => patch({ flow: id, detail: null })} onOpenArea={id => patch({ page: 'areas', area: id, term: null, flow: null, detail: null })} onOpenResource={openResource} onBack={() => window.history.back()} onClose={() => patch({ flow: null, detail: null })} />
      : flagEntry ? <FlagPage entry={flagEntry} onSelectFlow={flow => patch({ flow: flow.id, flag: null })} />
      : fileEntry ? <FilePage entry={fileEntry} onSelectFlow={flow => patch({ flow: flow.id, detail: 'code', file: null })} onOpenRoute={id => patch({ page: 'monolith', file: null, drawer: 'skello-app', ep: id })} onOpenResource={openResource} />
      : <FlowsIndex service={url.flows} flows={map.flows} map={map} onSelectFlow={flow => patch({ flow: flow.id })} />)
    : url.page === 'resources' ? (url.resource
      ? <ResourcePage id={url.resource} onOpenResource={openResource} onOpenFile={key => patch({ page: 'flows', resource: null, file: key })} onOpenFlow={id => patch({ page: 'flows', flow: id })} onSelectService={selectService} onBlast={id => patch({ page: 'impact', blast: id })} />
      : <ResourcesIndex onOpenResource={openResource} />)
    : url.page === 'impact' ? <ImpactPage origin={url.blast} onPick={id => patch({ blast: id })} onSelect={node => (resourceIds.has(node) ? openResource(node) : selectService(node))} onOpenFlow={id => patch({ page: 'flows', flow: id })} />
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
