import { useCallback, useEffect, useState } from 'react'
import { selectServicePatch, useUrlState, type UrlState } from '../hooks/useUrlState'
import { SearchModal } from '../components/SearchModal'
import { NotFoundBanner } from '../components/areas/NotFoundBanner'
import { AreasHome } from '../components/areas/AreasHome'
import { AreaPage } from '../components/areas/AreaPage'
import { FlowView } from '../components/connectivity/FlowGraphModal'
import { FlowListModal } from '../components/connectivity/FlowListModal'
import { FlagModal } from '../components/connectivity/FlagModal'
import { FileModal } from '../components/connectivity/FileModal'
import { ResourcePage } from '../components/resources/ResourcePage'
import { ResourcesIndex } from '../components/resources/ResourcesIndex'
import { ImpactPanel } from '../components/resources/ImpactPanel'
import { OwnershipPage } from '../components/ownership/OwnershipPage'
import { AppShell } from './AppShell'
import { HomePage } from './HomePage'
import { MicroservicesPage } from './MicroservicesPage'
import { fileIndex, flagRegistry, map, resourceIds, searchIndex } from './dataIndexes'
import { validateUrlState } from './validateUrlState'

type Patch = (p: Partial<UrlState>) => void

function FlowsFallback({ url, patch, onOpenResource }: { url: UrlState; patch: Patch; onOpenResource: (id: string) => void }) {
  const flag = url.flag ? flagRegistry.get(url.flag) : undefined
  const file = url.file ? fileIndex.get(url.file) : undefined
  if (flag) {
    return <FlagModal entry={flag} onSelectFlow={flow => patch({ flow: flow.id, flag: null })} onClose={() => patch({ flag: null })} />
  }
  if (file) {
    return <FileModal entry={file} onSelectFlow={flow => patch({ flow: flow.id, detail: 'code', file: null })} onOpenRoute={id => patch({ page: 'monolith', file: null, drawer: 'skello-app', ep: id })} onOpenResource={onOpenResource} onClose={() => patch({ file: null })} />
  }
  return <FlowListModal serviceName={url.flows ?? ''} flows={map.flows} map={map} onSelectFlow={flow => patch({ flow: flow.id })} onClose={() => patch({ page: 'home', flows: null })} />
}

function ImpactFallback({ url, patch, onSelect }: { url: UrlState; patch: Patch; onSelect: (node: string) => void }) {
  if (!url.blast) {
    return null
  }
  return <ImpactPanel origin={url.blast} onSelect={onSelect} onOpenFlow={id => patch({ page: 'flows', flow: id })} onClose={() => patch({ blast: null })} />
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

  const openResource = useCallback((id: string) => patch({ page: 'resources', flow: null, detail: null, file: null, resource: id }), [patch])
  const selectService = useCallback((name: string) => patch(selectServicePatch(name)), [patch])
  const selectedFlow = url.flow ? map.flows.find(f => f.id === url.flow) ?? null : null

  const content =
    url.page === 'home' ? <HomePage index={searchIndex} onNavigate={patch} />
    : url.page === 'areas' ? (url.area
      ? <AreaPage map={map} areaId={url.area} term={url.term} onBack={() => patch({ area: null, term: null })} onOpenFlow={id => patch({ page: 'flows', flow: id })} onOpenArea={id => patch({ area: id, term: null })} onSelectService={selectService} />
      : <AreasHome map={map} onOpenArea={id => patch({ area: id, term: null })} onOpenContext={() => patch({ page: 'microservices', s: null })} />)
    : url.page === 'microservices' || url.page === 'monolith' ? <MicroservicesPage url={url.page === 'monolith' ? { ...url, s: 'skello-app' } : url} patch={patch} onOpenResource={openResource} />
    : url.page === 'flows' ? (selectedFlow
      ? <FlowView flow={selectedFlow} map={map} detail={url.detail} onDetailChange={d => patch({ detail: d })} onOpenFlow={id => patch({ flow: id, detail: null })} onOpenArea={id => patch({ page: 'areas', area: id, term: null, flow: null, detail: null })} onOpenResource={openResource} onBack={() => window.history.back()} onClose={() => patch({ flow: null, detail: null })} />
      : <FlowsFallback url={url} patch={patch} onOpenResource={openResource} />)
    : url.page === 'resources' ? (url.resource
      ? <ResourcePage id={url.resource} onOpenResource={openResource} onOpenFile={key => patch({ page: 'flows', resource: null, file: key })} onOpenFlow={id => patch({ page: 'flows', flow: id })} onSelectService={selectService} onBlast={id => patch({ page: 'impact', blast: id })} />
      : <ResourcesIndex onOpenResource={openResource} />)
    : url.page === 'impact' ? <ImpactFallback url={url} patch={patch} onSelect={node => (resourceIds.has(node) ? openResource(node) : selectService(node))} />
    : <OwnershipPage map={map} focusedTeam={url.team} onFocusTeam={team => patch({ team })} onSelectService={selectService} onOpenArea={id => patch({ page: 'areas', area: id, term: null })} />

  return (
    <>
      <AppShell url={url} onNavigate={patch} onSearch={() => setSearchOpen(true)} onTogglePresent={() => patch({ present: !url.present })} panel={null}>
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
