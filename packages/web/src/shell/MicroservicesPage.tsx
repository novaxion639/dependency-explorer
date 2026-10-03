import { useState } from 'react'
import { edgeKey, selectServicePatch, type UrlState } from '../hooks/useUrlState'
import { ServiceSidebar } from '../components/connectivity/ServiceSidebar'
import { ConnectivityGraph } from '../components/connectivity/ConnectivityGraph'
import { FlowsPanel } from '../components/connectivity/FlowsPanel'
import { SystemContext } from '../components/areas/SystemContext'
import { ServiceHeader } from './ServiceHeader'
import { map } from './dataIndexes'
import styles from './MicroservicesPage.module.css'

interface Props {
  url: UrlState
  patch: (p: Partial<UrlState>) => void
  onOpenResource: (id: string) => void
}

export function MicroservicesPage({ url, patch, onOpenResource }: Props) {
  const [search, setSearch] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const service = url.s ? map.services.find(s => s.name === url.s) ?? null : null
  const select = (name: string) => {
    setListOpen(false)
    patch(selectServicePatch(name))
  }
  return (
    <div className={styles.page}>
      <ServiceSidebar services={map.services} teams={map.teams} selected={url.s} onSelect={select} search={search} onSearch={setSearch} open={listOpen} onClose={() => setListOpen(false)} />
      <div className={styles.content}>
        <button type="button" className={styles.listToggle} onClick={() => setListOpen(true)}>Services</button>
        {service ? (
          <>
            <ServiceHeader service={service} onBlast={() => patch({ page: 'impact', blast: service.name })} onOpenResource={onOpenResource} />
            <div className="legacy-canvas">
              <ConnectivityGraph
                map={map}
                selectedService={url.s}
                onSelectService={select}
                onOpenFlows={name => patch({ page: 'flows', flows: name, flow: null })}
                blastRadius={null}
                onEdgeSelect={conn => patch({ edge: conn ? edgeKey(conn.from, conn.to, conn.protocol) : null })}
                onOpenResource={onOpenResource}
              />
            </div>
            <FlowsPanel flows={map.flows} selectedService={service.name} map={map} onSelectService={select} onOpenFlow={flow => patch({ page: 'flows', flow: flow.id })} />
          </>
        ) : (
          <div className="legacy-canvas">
            <SystemContext map={map} onSelectService={select} onOpenArea={id => patch({ page: 'areas', area: id, term: null })} />
          </div>
        )}
      </div>
    </div>
  )
}
