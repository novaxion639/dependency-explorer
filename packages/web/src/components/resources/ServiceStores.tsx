import type { ConnectivityService } from '@dependency-explorer/data'
import { resourceIdForDatabase, resourceSurface } from '@dependency-explorer/data'
import styles from './ServiceStores.module.css'

export function ServiceStores({ service, onOpenResource }: { service: ConnectivityService; onOpenResource: (id: string) => void }) {
  const stores = (service.databases ?? []).map(db => ({ db, id: resourceIdForDatabase(service.name, db, resourceSurface.resources) }))
  if (!stores.length) {
    return null
  }
  return (
    <div aria-label="Stores" className={styles.stores}>
      Stores
      {stores.map(({ db, id }) => id
        ? <button key={`${db.type}:${db.name}`} type="button" onClick={() => onOpenResource(id)} title={db.description}>{db.name}</button>
        : <span key={`${db.type}:${db.name}`} title={db.description}>{db.name}</span>)}
    </div>
  )
}
