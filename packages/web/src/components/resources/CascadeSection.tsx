import { WRITE_EVENTS, alsoChanges, cascadeFrom, listenerSurface, type CascadeNode, type WriteEvent } from '@dependency-explorer/data'
import { plural } from '../../utils/plural'
import { GradeGlyph } from './ListenersSection'
import { LISTENER_EVENTS, tableName } from './listenerView'
import styles from './ResourcePage.module.css'

interface Props {
  table: string
  event: WriteEvent | null
  onEvent: (e: WriteEvent) => void
  onOpenResource: (id: string) => void
}

export function CascadeHops({ nodes, onOpenResource }: { nodes: CascadeNode[]; onOpenResource: (id: string) => void }) {
  return (
    <ul className={styles.tree}>
      {nodes.flatMap(n => n.hops.map((h, i) => (
        <li key={`${n.listener.id}:${i}`}>
          <GradeGlyph unverified={h.grade === 'text'} />
          <button type="button" className={styles.link} onClick={() => onOpenResource(h.table)}>{tableName(h.table)}</button>
          <span className={styles.meta}>
            {` ← ${n.listener.method ?? n.listener.hook} · ${h.mode} · ${(h.effect.events ?? WRITE_EVENTS).join(' ')}`}
            {(h.effect.runs ?? 'none') === 'none' ? ` · runs none, skips ${plural(h.skipped, 'listener')}` : ''}
            {h.cycle ? ' · ↻ cycle' : ''}
          </span>
          {h.next.length > 0 && <CascadeHops nodes={h.next} onOpenResource={onOpenResource} />}
        </li>
      )))}
    </ul>
  )
}

export function CascadeSection({ table, event, onEvent, onOpenResource }: Props) {
  const reached = alsoChanges(listenerSurface, table)
  if (!reached.length) {
    return null
  }
  const selected = event ?? 'update'
  const nodes = cascadeFrom(listenerSurface, table, selected)
  return (
    <section aria-label="Also changes" className={styles.section}>
      <h2>{`Also changes · ${plural(reached.length, 'table')} across all events`}</h2>
      <div role="group" aria-label="Cascade event" className={styles.filters}>
        {LISTENER_EVENTS.map(e => <button key={e} type="button" className={styles.chip} aria-pressed={e === selected} onClick={() => onEvent(e)}>{e}</button>)}
      </div>
      {nodes.some(n => n.hops.length > 0)
        ? <CascadeHops nodes={nodes} onOpenResource={onOpenResource} />
        : <p className={styles.meta}>{`No table changes on ${selected}.`}</p>}
    </section>
  )
}
