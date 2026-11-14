import type { ConnectivityService } from '@dependency-explorer/data'
import { resourceIdForDatabase, resourceSurface } from '@dependency-explorer/data'
import { SkChip } from '@skelloapp/skello-ds-web'
import { resourcePatch } from '../../hooks/useUrlState'
import { NavChip } from '../../shell/NavLink'
import styles from './ServiceStores.module.css'

export function ServiceStores({ service }: { service: ConnectivityService }) {
  const stores = (service.databases ?? []).map(db => ({ db, id: resourceIdForDatabase(service.name, db, resourceSurface.resources) }))
  if (!stores.length) {
    return null
  }
  return (
    <div aria-label="Stores" className={styles.stores}>
      Stores
      {stores.map(({ db, id }) => id
        ? <NavChip key={`${db.type}:${db.name}`} patch={resourcePatch(id)} label={db.name} title={db.description} />
        : <SkChip key={`${db.type}:${db.name}`} size="small" label={db.name} title={db.description} />)}
    </div>
  )
}
