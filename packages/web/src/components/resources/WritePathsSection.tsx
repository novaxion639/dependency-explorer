import { connectivityMap, listenerSurface, type Runs } from '@dependency-explorer/data'
import { GradeGlyph, Source } from './ListenersSection'
import styles from './ResourcePage.module.css'

const ORDER: readonly Runs[] = ['all', 'subset', 'validation', 'touch', 'none']
const LABEL: Record<Runs, string> = { all: 'Runs every listener', subset: 'Hand-fires a subset', validation: 'Runs validation listeners only', touch: 'Runs touch and commit listeners', none: 'Runs no listener' }

export function WritePathsSection({ table, onOpenFlow }: { table: string; onOpenFlow: (id: string) => void }) {
  const sites = listenerSurface.writeSites.filter(s => s.table === table)
  if (!sites.length) {
    return null
  }
  const methodOf = new Map(listenerSurface.listeners.map(l => [l.id, l.method ?? l.hook]))
  return (
    <section aria-label="Write paths" className={styles.section}>
      <h2>{`Write paths · ${sites.length}`}</h2>
      {ORDER.map(runs => {
        const group = sites.filter(s => s.runs === runs)
        if (!group.length) {
          return null
        }
        return (
          <div key={runs} className={styles.group}>
            <span className={styles.service}>{LABEL[runs]}</span><span className={styles.count}>{` ${group.length}`}</span>
            <ul className={styles.rels}>
              {group.map(s => {
                const flows = connectivityMap.flows.filter(f => (f.codeUnits ?? []).some(u => u.service === 'skello-app' && u.path === s.file))
                return (
                  <li key={`${s.file}:${s.line}:${s.call}`}>
                    <GradeGlyph unverified={s.grade === 'text'} />
                    <code>{s.call}</code> <span className={styles.meta}>written at </span><Source at={{ file: s.file, line: s.line }} />
                    {s.fires && <span className={styles.meta}>{` fires ${s.fires.map(id => methodOf.get(id) ?? id).join(', ')}`}</span>}
                    {flows.map(f => <button key={f.id} type="button" className={styles.chip} onClick={() => onOpenFlow(f.id)}>{f.name}</button>)}
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
