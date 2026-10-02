import type { ConnectivityService } from '@dependency-explorer/data'
import { resourceIdForDatabase, resourceSurface } from '@dependency-explorer/data'

export function ServiceStores({ service, onOpenResource }: { service: ConnectivityService; onOpenResource: (id: string) => void }) {
  const stores = (service.databases ?? []).map(db => ({ db, id: resourceIdForDatabase(service.name, db, resourceSurface.resources) }))
  if (!stores.length) {
    return null
  }
  return (
    <div aria-label="Stores" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', fontSize: 10, color: '#64748b' }}>
      Stores
      {stores.map(({ db, id }) => id
        ? <button key={`${db.type}:${db.name}`} type="button" onClick={() => onOpenResource(id)} title={db.description} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, border: '1px solid #2e3250', background: 'transparent', color: '#cbd5e1', cursor: 'pointer' }}>{db.name}</button>
        : <span key={`${db.type}:${db.name}`} title={db.description} style={{ padding: '1px 6px' }}>{db.name}</span>)}
    </div>
  )
}
