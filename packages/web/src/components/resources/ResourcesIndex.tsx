import type { Resource } from '@dependency-explorer/data'
import type { UrlState } from '../../hooks/useUrlState'
import { listenerMetrics, listenerSurface, resourceSurface } from '@dependency-explorer/data'
import { plural } from '../../utils/plural'
import { filterResources, type ResourceSort } from './resourceFilter'
import styles from './ResourcesIndex.module.css'

const metrics = listenerMetrics(listenerSurface)
const SORTS: readonly ResourceSort[] = ['name', 'listeners', 'alsoChanges', 'bypassing']
const SORT_LABEL: Record<ResourceSort, string> = { name: 'name', listeners: 'listeners', alsoChanges: 'also changes', bypassing: 'bypassing writes' }
const NO_METRICS = { listeners: 0, alsoChanges: 0, bypassing: 0 }
const isPgTable = (r: Resource) => r.kind === 'table' && r.id.startsWith('pg:')
const owners = [...new Set(resourceSurface.resources.flatMap(r => (r.owner ? [r.owner] : [])))].sort()

const KINDS: ReadonlyArray<Resource['kind'] | 'all'> = ['all', 'table', 'queue', 'topic', 'stream', 'bucket', 'database']

interface Props {
  url: Pick<UrlState, 'rkind' | 'rowner' | 'rsort' | 'orphans' | 'cycles'>
  patch: (p: Partial<UrlState>) => void
  onOpenResource: (id: string) => void
}

export function ResourcesIndex({ url, patch, onOpenResource }: Props) {
  const kind = KINDS.find(k => k === url.rkind) ?? 'all'
  const owner = url.rowner ?? 'all'
  const sort = SORTS.find(x => x === url.rsort) ?? 'name'
  const visible = filterResources(resourceSurface.resources, { kind, owner, orphansOnly: url.orphans, cyclesOnly: url.cycles, sort }, metrics)
  const stores = [...new Set(visible.map(r => r.store))].sort()
  return (
    <section aria-label="Resources" className={styles.page}>
      <h1>Resources</h1>
      <div className={styles.filters}>
        <label>Kind <select aria-label="Kind" value={kind} onChange={e => patch({ rkind: e.target.value === 'all' ? null : e.target.value })}>{KINDS.map(k => <option key={k} value={k}>{k}</option>)}</select></label>
        <label>Owner <select aria-label="Owner" value={owner} onChange={e => patch({ rowner: e.target.value === 'all' ? null : e.target.value })}>{['all', ...owners].map(o => <option key={o} value={o}>{o}</option>)}</select></label>
        <label><input type="checkbox" checked={url.orphans} onChange={e => patch({ orphans: e.target.checked })} /> Not in any flow</label>
        <label>Sort <select aria-label="Sort" value={sort} onChange={e => patch({ rsort: e.target.value === 'name' ? null : e.target.value })}>{SORTS.map(x => <option key={x} value={x}>{SORT_LABEL[x]}</option>)}</select></label>
        <label><input type="checkbox" checked={url.cycles} onChange={e => patch({ cycles: e.target.checked })} /> Cycles only</label>
        <span>{visible.length} of {resourceSurface.resources.length}</span>
      </div>
      {stores.map(store => (
        <section key={store} aria-label={store}>
          <h2 className={styles.store}>{store}</h2>
          <ul className={styles.grid}>
            {visible.filter(r => r.store === store).map(r => {
              const m = metrics.get(r.id) ?? NO_METRICS
              return (
                <li key={r.id}>
                  <button type="button" className={styles.card} onClick={() => onOpenResource(r.id)}>
                    {r.name}<small>{r.kind}{r.owner ? ` · ${r.owner}` : ''}</small>
                    {isPgTable(r) && <small>{`${plural(m.listeners, 'listener')} · ${plural(m.alsoChanges, 'also change')} · ${plural(m.bypassing, 'bypassing write')}`}</small>}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </section>
  )
}
