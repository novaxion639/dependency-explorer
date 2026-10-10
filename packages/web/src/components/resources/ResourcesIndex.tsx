import { useState } from 'react'
import type { Resource } from '@dependency-explorer/data'
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

export function ResourcesIndex({ onOpenResource }: { onOpenResource: (id: string) => void }) {
  const [kind, setKind] = useState<Resource['kind'] | 'all'>('all')
  const [owner, setOwner] = useState('all')
  const [orphansOnly, setOrphansOnly] = useState(false)
  const [sort, setSort] = useState<ResourceSort>('name')
  const [cyclesOnly, setCyclesOnly] = useState(false)
  const visible = filterResources(resourceSurface.resources, { kind, owner, orphansOnly, cyclesOnly, sort }, metrics)
  const stores = [...new Set(visible.map(r => r.store))].sort()
  const kinds: Array<Resource['kind'] | 'all'> = ['all', 'table', 'queue', 'topic', 'stream', 'bucket', 'database']
  return (
    <section aria-label="Resources" className={styles.page}>
      <h1>Resources</h1>
      <div className={styles.filters}>
        <label>Kind <select aria-label="Kind" value={kind} onChange={e => setKind(kinds.find(k => k === e.target.value) ?? 'all')}>{kinds.map(k => <option key={k} value={k}>{k}</option>)}</select></label>
        <label>Owner <select aria-label="Owner" value={owner} onChange={e => setOwner(e.target.value)}>{['all', ...owners].map(o => <option key={o} value={o}>{o}</option>)}</select></label>
        <label><input type="checkbox" checked={orphansOnly} onChange={e => setOrphansOnly(e.target.checked)} /> Not in any flow</label>
        <label>Sort <select aria-label="Sort" value={sort} onChange={e => setSort(SORTS.find(x => x === e.target.value) ?? 'name')}>{SORTS.map(x => <option key={x} value={x}>{SORT_LABEL[x]}</option>)}</select></label>
        <label><input type="checkbox" checked={cyclesOnly} onChange={e => setCyclesOnly(e.target.checked)} /> Cycles only</label>
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
