import type { ServiceFlow, ConnectivityMap } from '@dependency-explorer/data'
import { getFlowAreas } from '@dependency-explorer/data'
import { AreaChip } from '../areas/AreaChip'
import { STORE_META } from '../storeTypes'
import styles from './FlowsPanel.module.css'

interface Props {
  flows: ServiceFlow[]
  selectedService: string
  map: ConnectivityMap
  onSelectService: (name: string) => void
  onOpenFlow: (flow: ServiceFlow) => void
}

function FlowCard({ flow, selectedService, map, onSelectService, onOpen }: { flow: ServiceFlow; selectedService: string; map: ConnectivityMap; onSelectService: (name: string) => void; onOpen: () => void }) {
  const chain = [...new Set(flow.steps.flatMap(s => [s.from, s.to]))]
  const areas = getFlowAreas(flow, map.areas ?? [])
  return (
    <article className={styles.card} aria-label={flow.name}>
      <button type="button" className={styles.open} onClick={onOpen}>
        <b>{flow.name}</b>
        <span>View flow →</span>
      </button>
      {flow.description && <p className={styles.description}>{flow.description}</p>}
      {areas.length > 0 && <div className={styles.areas}>{areas.map(a => <AreaChip key={a.id} area={a} primary={a.id === flow.primaryArea} />)}</div>}
      <div className={styles.chain}>
        {chain.map((name, i) => (
          <span key={name}>
            {i > 0 && <span aria-hidden="true"> → </span>}
            <button type="button" aria-current={name === selectedService ? 'true' : undefined} title={flow.steps.find(s => s.from === name || s.to === name)?.action} onClick={() => onSelectService(name)}>{name}</button>
          </span>
        ))}
      </div>
      {(flow.infraNodes ?? []).length > 0 && (
        <ul className={styles.infra}>
          {(flow.infraNodes ?? []).map(infra => {
            const cruds = [...new Set((flow.infraEdges ?? []).filter(e => e.to === infra.id).flatMap(e => e.crud ?? []))]
            return (
              <li key={infra.id} title={infra.description}>
                {STORE_META[infra.type]?.icon ?? '💾'} {infra.label}
                {cruds.length > 0 && <b> {cruds.map(c => c.charAt(0).toUpperCase()).join('')}</b>}
              </li>
            )
          })}
        </ul>
      )}
    </article>
  )
}

export function FlowsPanel({ flows, selectedService, map, onSelectService, onOpenFlow }: Props) {
  const relevant = flows.filter(f => f.steps.some(s => s.from === selectedService || s.to === selectedService))
  if (relevant.length === 0) {
    return null
  }
  return (
    <section aria-label="Request flows" className={styles.panel}>
      <h2>Request flows</h2>
      <div className={styles.list}>
        {relevant.map(flow => <FlowCard key={flow.id} flow={flow} selectedService={selectedService} map={map} onSelectService={onSelectService} onOpen={() => onOpenFlow(flow)} />)}
      </div>
    </section>
  )
}
