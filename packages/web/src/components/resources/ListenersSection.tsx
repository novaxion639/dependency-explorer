import type { Listener } from '@dependency-explorer/data'
import { listenerSurface } from '@dependency-explorer/data'
import { LISTENER_EVENTS, LISTENER_GRADES, LISTENER_KINDS, effectText, filterListeners, gradeGlyph, gradeLabel, hasText, sourceHref, type ListenerUrl } from './listenerView'
import styles from './ResourcePage.module.css'

type Filters = Pick<ListenerUrl, 'lev' | 'lkind' | 'lgrade'>

interface Props {
  listeners: Listener[]
  filters: Filters
  open: string | null
  onFilters: (p: Partial<Filters>) => void
  onToggle: (id: string | null) => void
  onOpenResource: (id: string) => void
}

const known = (value: string | null, options: readonly string[]) => (value !== null && options.includes(value) ? value : null)

function GradeGlyph({ unverified, title }: { unverified: boolean; title?: string }) {
  return <span role="img" aria-label={gradeLabel(unverified)} title={title} className={styles.grade} data-grade={unverified ? 'flow' : 'code'}>{gradeGlyph(unverified)}</span>
}

export function Source({ at }: { at: { file: string; line: number } }) {
  const href = sourceHref(at, listenerSurface.pins)
  const text = `${at.file}:${at.line}`
  return href ? <a href={href} target="_blank" rel="noreferrer">{text}</a> : <code>{text}</code>
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string | null; options: readonly string[]; onChange: (v: string | null) => void }) {
  return (
    <label className={styles.meta}>
      {label}{' '}
      <select aria-label={label} value={value ?? 'all'} onChange={e => onChange(e.target.value === 'all' ? null : e.target.value)}>
        {['all', ...options].map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

export function ListenersSection({ listeners, filters, open, onFilters, onToggle, onOpenResource }: Props) {
  if (!listeners.length) {
    return null
  }
  const active: Filters = { lev: known(filters.lev, LISTENER_EVENTS), lkind: known(filters.lkind, LISTENER_KINDS), lgrade: known(filters.lgrade, LISTENER_GRADES) }
  const visible = filterListeners(listeners, active)
  return (
    <section aria-label="Listeners" className={styles.section}>
      <h2>{`Listeners · ${visible.length} of ${listeners.length}`}</h2>
      <div className={styles.filters}>
        <FilterSelect label="Event" value={active.lev} options={LISTENER_EVENTS} onChange={lev => onFilters({ lev })} />
        <FilterSelect label="Kind" value={active.lkind} options={LISTENER_KINDS} onChange={lkind => onFilters({ lkind })} />
        <FilterSelect label="Grade" value={active.lgrade} options={LISTENER_GRADES} onChange={lgrade => onFilters({ lgrade })} />
      </div>
      {visible.length === 0 && <p className={styles.meta}>No listener matches these filters.</p>}
      {visible.length > 0 && <ol className={styles.listeners}>
        {visible.map(l => {
          const expanded = open === l.id
          return (
            <li key={l.id}>
              <GradeGlyph unverified={hasText(l)} />
              <button type="button" aria-expanded={expanded} className={styles.link} onClick={() => onToggle(expanded ? null : l.id)}>
                <code>{l.hook}</code>{` ${l.method ?? 'block'} · ${l.events.join(' ')}`}
              </button>
              {l.condition && <code className={styles.condition}>{l.condition}</code>}
              <span className={styles.meta}> declared <Source at={l.declaredAt} />{l.definedAt && <> · defined <Source at={l.definedAt} /></>}</span>
              {expanded && (
                <ul className={styles.rels}>
                  {l.effects.length === 0 && <li className={styles.meta}>No effect on another table, job or service.</li>}
                  {l.effects.map(e => (
                    <li key={`${e.kind}:${e.target}:${e.at.file}:${e.at.line}:${e.via ?? ''}`}>
                      <GradeGlyph unverified={e.grade === 'text'} title={e.grade === 'text' ? 'receiver named after the model — review' : `${e.grade} evidence at the pinned commit`} />
                      {e.kind === 'writes' ? <button type="button" className={styles.link} onClick={() => onOpenResource(e.target)}>{effectText(e)}</button> : effectText(e)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ol>}
    </section>
  )
}
