import { useState } from 'react'
import { allResourceRelations, connectivityMap, resourceSurface } from '@dependency-explorer/data'
import { computeImpact } from '../../utils/impact'
import type { Renderer } from '../../diagram/model'
import { ImpactMap } from './ImpactMap'
import styles from './ImpactPage.module.css'

interface Props {
  origin: string | null
  onPick: (id: string) => void
  onSelect: (node: string) => void
  onOpenFlow: (id: string) => void
  renderer?: Renderer
  onRenderer?: (renderer: Renderer) => void
}

const ORIGINS = [...connectivityMap.services.map(s => s.name), ...resourceSurface.resources.map(r => r.id)]
const KNOWN = new Set(ORIGINS)

function Picker({ onPick }: { onPick: (id: string) => void }) {
  return (
    <section aria-label="Impact" className={styles.page}>
      <h1>If something is down…</h1>
      <p className={styles.muted}>Pick a service or a resource to see what depends on it, by hop.</p>
      <input
        className={styles.pick}
        list="impact-origins"
        aria-label="Service or resource"
        placeholder="svc-requests · pg:skello_production.shifts · sqs:…"
        onChange={e => {
          if (KNOWN.has(e.target.value)) {
            onPick(e.target.value)
          }
        }}
      />
      <datalist id="impact-origins">{ORIGINS.map(id => <option key={id} value={id} />)}</datalist>
    </section>
  )
}

export function ImpactPage({ origin, onPick, onSelect, onOpenFlow, renderer = 'react-flow', onRenderer = () => {} }: Props) {
  const [filter, setFilter] = useState<'all' | 'sync'>('all')
  const [showMap, setShowMap] = useState(false)
  if (!origin) {
    return <Picker onPick={onPick} />
  }
  const impact = computeImpact(connectivityMap, allResourceRelations, origin)
  const entries = impact.entries.filter(e => filter === 'all' || (e.mode === 'sync' && e.effect === 'fails'))
  const hops = [...new Set(entries.map(e => e.hop))].sort((a, b) => a - b)
  return (
    <section aria-label={`Impact of ${origin}`} className={styles.page}>
      <h1>If {origin} is down</h1>
      <div role="group" aria-label="Filter" className={styles.filter}>
        {(['all', 'sync'] as const).map(f => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === 'all' ? 'All effects' : 'Hard failures (sync)'}</button>
        ))}
      </div>
      <button type="button" className={styles.mapToggle} aria-expanded={showMap} onClick={() => setShowMap(open => !open)}>{showMap ? 'Hide the map' : 'Show on the map'}</button>
      {showMap && (
        <div className={styles.map}>
          <ImpactMap origin={origin} renderer={renderer} onRenderer={onRenderer} onSelectService={onSelect} />
        </div>
      )}
      {entries.length === 0 && <p className={styles.muted}>Nothing on the map depends on {origin}.</p>}
      {hops.map(hop => (
        <section key={hop} aria-label={`Hop ${hop}`}>
          <h2 className={styles.hop}>Hop {hop}</h2>
          <ul className={styles.entries}>
            {entries.filter(e => e.hop === hop).map(e => (
              <li key={e.node}>
                <button type="button" onClick={() => onSelect(e.node)}>{e.node}</button>
                <span className={styles.effect} data-effect={e.effect}>{e.effect === 'fails' && e.hop > 1 ? 'may fail' : e.effect}</span>
                <span className={styles.muted}>via {e.via} ({e.mode})</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {impact.flows.length > 0 && (
        <section aria-label="Affected flows">
          <h2 className={styles.hop}>Affected flows</h2>
          <ul className={styles.entries}>
            {impact.flows.map(f => (
              <li key={f.flowId}><button type="button" onClick={() => onOpenFlow(f.flowId)}>{f.name} — breaks at step {f.step}: {f.from} → {f.to}</button></li>
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}
