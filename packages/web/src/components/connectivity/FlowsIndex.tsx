import type { ServiceFlow, ConnectivityMap } from '@dependency-explorer/data'
import { getFlowAreas } from '@dependency-explorer/data'
import { AreaChip } from '../areas/AreaChip'
import styles from './listPage.module.css'
import own from './FlowsIndex.module.css'

interface Props {
  service: string | null
  flows: ServiceFlow[]
  map: ConnectivityMap
  onSelectFlow: (flow: ServiceFlow) => void
}

function firstSentence(text: string): string {
  const end = text.search(/\.\s/)
  return end === -1 ? text : text.slice(0, end + 1)
}

function chain(flow: ServiceFlow): string[] {
  return [...new Set(flow.steps.flatMap(s => [s.from, s.to]))]
}

function FlowCard({ flow, service, map, onSelect }: { flow: ServiceFlow; service: string | null; map: ConnectivityMap; onSelect: () => void }) {
  const areas = getFlowAreas(flow, map.areas ?? [])
  return (
    <button type="button" className={styles.card} onClick={onSelect}>
      <b>{flow.name}</b>
      <small>{firstSentence(flow.description)}</small>
      {areas.length > 0 && <span className={own.areas}>{areas.map(a => <AreaChip key={a.id} area={a} primary={a.id === flow.primaryArea} />)}</span>}
      <small className={own.chain}>
        {chain(flow).map((name, i) => (
          <span key={name}>{i > 0 && ' → '}{name === service ? <mark>{name}</mark> : name}</span>
        ))}
      </small>
    </button>
  )
}

export function FlowsIndex({ service, flows, map, onSelectFlow }: Props) {
  if (service) {
    const relevant = flows.filter(f => f.steps.some(s => s.from === service || s.to === service))
    return (
      <section aria-label="Flows" className={styles.page}>
        <h1 className={styles.title}>Flows through {service}</h1>
        <p className={styles.meta}>{service} takes part in {relevant.length} flow{relevant.length !== 1 ? 's' : ''}</p>
        {relevant.length === 0 ? <p className={styles.meta}>No flows found for this service.</p> : (
          <ul className={styles.cards}>{relevant.map(f => <li key={f.id}><FlowCard flow={f} service={service} map={map} onSelect={() => onSelectFlow(f)} /></li>)}</ul>
        )}
      </section>
    )
  }
  const groups = new Map<string, ServiceFlow[]>()
  for (const area of map.areas ?? []) {
    groups.set(area.name, [])
  }
  for (const flow of flows) {
    const name = getFlowAreas(flow, map.areas ?? [])[0]?.name ?? 'Other'
    groups.set(name, [...(groups.get(name) ?? []), flow])
  }
  return (
    <section aria-label="Flows" className={styles.page}>
      <h1 className={styles.title}>Flows</h1>
      <p className={styles.meta}>{flows.length} flows, grouped by product area</p>
      {[...groups].filter(([, list]) => list.length > 0).map(([name, list]) => (
        <section key={name} aria-label={name}>
          <h2 className={styles.group}>{name}</h2>
          <ul className={styles.cards}>{list.map(f => <li key={f.id}><FlowCard flow={f} service={null} map={map} onSelect={() => onSelectFlow(f)} /></li>)}</ul>
        </section>
      ))}
    </section>
  )
}
