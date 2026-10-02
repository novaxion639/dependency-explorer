import { useState } from 'react'
import type { Resource } from '@dependency-explorer/data'
import { resourceSurface } from '@dependency-explorer/data'
import { filterResources } from './resourceFilter'

const owners = [...new Set(resourceSurface.resources.flatMap(r => (r.owner ? [r.owner] : [])))].sort()

export function ResourcesIndex({ onOpenResource }: { onOpenResource: (id: string) => void }) {
  const [kind, setKind] = useState<Resource['kind'] | 'all'>('all')
  const [owner, setOwner] = useState('all')
  const [orphansOnly, setOrphansOnly] = useState(false)
  const visible = filterResources(resourceSurface.resources, { kind, owner, orphansOnly })
  const stores = [...new Set(visible.map(r => r.store))].sort()
  const kinds: Array<Resource['kind'] | 'all'> = ['all', 'table', 'queue', 'topic', 'stream', 'bucket', 'database']
  return (
    <main style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
      <h1 style={{ fontSize: 18, color: '#e2e8f0' }}>Resources</h1>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '8px 0', fontSize: 11, color: '#94a3b8', flexWrap: 'wrap' }}>
        <label>Kind <select aria-label="Kind" value={kind} onChange={e => setKind(kinds.find(k => k === e.target.value) ?? 'all')}>{kinds.map(k => <option key={k} value={k}>{k}</option>)}</select></label>
        <label>Owner <select aria-label="Owner" value={owner} onChange={e => setOwner(e.target.value)}>{['all', ...owners].map(o => <option key={o} value={o}>{o}</option>)}</select></label>
        <label><input type="checkbox" checked={orphansOnly} onChange={e => setOrphansOnly(e.target.checked)} /> Not in any flow</label>
        <span>{visible.length} of {resourceSurface.resources.length}</span>
      </div>
      {stores.map(store => (
        <section key={store} aria-label={store} style={{ marginTop: 12 }}>
          <h2 style={{ fontSize: 12, color: '#94a3b8' }}>{store}</h2>
          <ul style={{ listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6, marginTop: 6 }}>
            {visible.filter(r => r.store === store).map(r => (
              <li key={r.id}>
                <button type="button" onClick={() => onOpenResource(r.id)} style={{ width: '100%', textAlign: 'left', padding: 8, borderRadius: 6, background: '#1a1d27', border: '1px solid #2e3250', color: '#e2e8f0', cursor: 'pointer', fontSize: 12 }}>
                  {r.name}<span style={{ display: 'block', fontSize: 10, color: '#64748b' }}>{r.kind}{r.owner ? ` · ${r.owner}` : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
