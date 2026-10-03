import { useEffect, useMemo, useState } from 'react'
import { resourceSurface, type ConnectivityService } from '@dependency-explorer/data'
import { selectServicePatch, type UrlState } from '../hooks/useUrlState'
import { ServiceSidebar } from '../components/connectivity/ServiceSidebar'
import { FlowsPanel } from '../components/connectivity/FlowsPanel'
import { Diagram } from '../diagram/Diagram'
import { NO_FOCUS, type FocusState } from '../diagram/focus'
import { refPatch, selectPatch } from '../diagram/refPatch'
import { areaEdges, areaGraph, areaSteps, defaultMinWeight } from '../diagram/layouts/areaGraph'
import { areaId } from '../diagram/layouts/ids'
import { overviewMap } from '../diagram/layouts/overview'
import { serviceByArea } from '../diagram/layouts/serviceByArea'
import { serviceByHow } from '../diagram/layouts/serviceByHow'
import { ServiceHeader } from './ServiceHeader'
import { map } from './dataIndexes'
import { keyInfo, presentStepKey, stepThrough } from './presentMode'
import styles from './MicroservicesPage.module.css'

interface Props {
  url: UrlState
  patch: (p: Partial<UrlState>) => void
}

const AREA_EDGES = areaEdges(map)
const AREA_STEPS = areaSteps(map, AREA_EDGES)
const MAX_WEIGHT = Math.max(1, ...AREA_EDGES.map(e => e.weight))
const MARKS = ['← calls it · → it calls · ⇄ both · ⇠ copies its data', 'line style = main mode']

function Overview({ url, patch }: Props) {
  const [minWeight, setMinWeight] = useState(() => defaultMinWeight(AREA_EDGES))
  const spotlight = url.area ? areaId(url.area) : null
  const model = useMemo(() => (url.present ? areaGraph(map, minWeight) : overviewMap(map, spotlight)), [url.present, minWeight, spotlight])
  const focus = useMemo<FocusState>(() => ({ spotlight, impact: null }), [spotlight])
  useEffect(() => {
    if (!url.present) {
      return
    }
    const onKey = (e: KeyboardEvent) => {
      const dir = presentStepKey(keyInfo(e))
      if (dir) {
        e.preventDefault()
        patch({ area: stepThrough(AREA_STEPS, url.area, dir) })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [url.present, url.area, patch])
  return (
    <Diagram
      model={model}
      focus={focus}
      renderer={url.renderer}
      onRenderer={renderer => patch({ renderer })}
      onSelect={ref => {
        const next = selectPatch(ref, url.present)
        if (next) {
          patch(next)
        }
      }}
      filename="microservices"
      notes={url.present ? ['← → step through the areas'] : ['select an area to draw its connections']}
    >
      {url.present && (
        <label className={styles.slider}>
          {`Connections ≥ ${minWeight}`}
          <input type="range" min={1} max={MAX_WEIGHT} value={minWeight} onChange={e => setMinWeight(Number(e.target.value))} aria-label="Minimum connections per edge" />
        </label>
      )}
    </Diagram>
  )
}

function ServiceView({ service, url, patch, onSelectService }: Props & { service: ConnectivityService; onSelectService: (name: string) => void }) {
  const model = useMemo(() => (url.present ? serviceByArea : serviceByHow)(map, resourceSurface.resources, service.name), [service.name, url.present])
  return (
    <>
      <ServiceHeader service={service} onBlast={() => patch({ page: 'impact', blast: service.name })} onOpenResource={id => patch(refPatch({ type: 'resource', id }))} />
      <Diagram
        model={model}
        focus={NO_FOCUS}
        renderer={url.renderer}
        onRenderer={renderer => patch({ renderer })}
        onSelect={ref => {
          const next = selectPatch(ref, url.present)
          if (next) {
            patch(next)
          }
        }}
        filename={`service_${service.name}`}
        notes={url.present ? MARKS : []}
      />
      {!url.present && (
        <FlowsPanel flows={map.flows} selectedService={service.name} map={map} onSelectService={onSelectService} onOpenFlow={flow => patch({ page: 'flows', flow: flow.id })} />
      )}
    </>
  )
}

export function MicroservicesPage({ url, patch }: Props) {
  const [search, setSearch] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const service = url.s ? map.services.find(s => s.name === url.s) ?? null : null
  const panelOpen = !service && Boolean(url.area || url.edge || url.drawer)
  const select = (name: string) => {
    setListOpen(false)
    patch(selectServicePatch(name))
  }
  return (
    <div className={styles.page}>
      {!url.present && !panelOpen && (
        <ServiceSidebar services={map.services} teams={map.teams} selected={url.s} onSelect={select} search={search} onSearch={setSearch} open={listOpen} onClose={() => setListOpen(false)} />
      )}
      <div className={styles.content}>
        {!url.present && <button type="button" className={styles.listToggle} onClick={() => setListOpen(true)}>Services</button>}
        {service ? <ServiceView service={service} url={url} patch={patch} onSelectService={select} /> : <Overview url={url} patch={patch} />}
      </div>
    </div>
  )
}
