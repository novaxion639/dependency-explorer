import { firedListeners, flowListenerDrift, flowListeners, listenerSurface, type FlowCodeUnit, type ServiceFlow } from '@dependency-explorer/data'
import { GradeGlyph } from '../resources/ListenersSection'
import { tableName } from '../resources/listenerView'
import styles from './flows.module.css'

interface Props { flow: ServiceFlow; unit: FlowCodeUnit; onOpenResource: (id: string) => void }

export function ListenerFacts({ flow, unit, onOpenResource }: Props) {
  const links = flowListeners(flow, listenerSurface).filter(l => l.unit === unit.id)
  const isCallbacks = unit.kind === 'model-callback'
  const derived = isCallbacks ? firedListeners(flow, listenerSurface) : []
  const drift = isCallbacks ? flowListenerDrift(flow, listenerSurface) : []
  return (
    <>
      {links.length > 0 && (
        <section>
          <h3>Fires</h3>
          <ul className={styles.plain}>
            {links.map(link => (
              <li key={`${link.table}:${link.site?.line ?? 'event'}`}>
                <GradeGlyph unverified={link.grade === 'text'} />
                <button type="button" onClick={() => onOpenResource(link.table)}>{tableName(link.table)}</button>
                <span className={styles.muted}>{link.site ? ` ${link.site.call} · runs ${link.site.runs}` : ' by table event — unverified'}</span>
                {` → ${link.listeners.length ? link.listeners.map(l => l.method ?? l.hook).join(', ') : 'no listener'}`}
              </li>
            ))}
          </ul>
        </section>
      )}
      {(derived.length > 0 || drift.length > 0) && (
        <section>
          <h3>Derived listeners</h3>
          <ul className={styles.plain}>
            {derived.map(l => <li key={l.id}>{`${l.hook} ${l.method ?? ''}`}</li>)}
            {drift.map(d => <li key={d.detail}>{`⚠ ${d.kind === 'flow-listener-missing' ? 'missing' : 'unsupported'}: ${d.detail}`}</li>)}
          </ul>
        </section>
      )}
    </>
  )
}
