import type { ConnectivityMap, ServiceConnection } from '@dependency-explorer/data'
import { STORE_META } from '../storeTypes'
import styles from './EdgeDetail.module.css'

interface Props {
  connection: ServiceConnection
  map: ConnectivityMap
  onSeeEndpoints: (serviceName: string) => void
  onClose: () => void
}

const SHOWN = 3

export function EdgeDetail({ connection, map, onSeeEndpoints, onClose }: Props) {
  const target = map.services.find(s => s.name === connection.to)
  const used = connection.usedEndpoints.flatMap(id => target?.endpoints.filter(e => e.id === id) ?? [])
  const shown = used.slice(0, SHOWN)
  const more = used.length > SHOWN || (target?.endpoints.length ?? 0) > shown.length
  const verified = connection.provenance?.source === 'discovered'
  return (
    <article aria-label="Connection" className={styles.edge}>
      <header className={styles.head}>
        <h2>{connection.from} <span aria-hidden="true">→</span> {connection.to}</h2>
        <button type="button" aria-label="Close" onClick={onClose}>×</button>
      </header>
      <p className={styles.description}>{connection.description}</p>
      <p className={styles.via}>via <code>{connection.sdkPackage}</code></p>
      <ul className={styles.tags}>
        <li data-mode={connection.communicationType}>{connection.communicationType}</li>
        <li>{connection.protocol}</li>
        <li>{connection.authType}</li>
        <li className={verified ? styles.verified : styles.manual} title={verified ? connection.provenance?.evidence : 'Declared manually — no machine evidence yet (run pnpm discover)'}>
          {verified ? `✓ verified in code ${connection.provenance?.lastVerified ?? ''}` : 'manual'}
        </li>
      </ul>
      {shown.length === 0 ? (
        <p className={styles.empty}>No endpoint details available.</p>
      ) : (
        <ul className={styles.endpoints}>
          {shown.map(ep => (
            <li key={ep.id}>
              <span className={styles.method}>{ep.method}</span> <code>{ep.path}</code>
              <p>{ep.description}</p>
              {(ep.awsCalls ?? []).length > 0 && (
                <p className={styles.calls}>{(ep.awsCalls ?? []).map(c => `${STORE_META[c.type]?.icon ?? '💾'} ${c.name}`).join(' · ')}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {more && (
        <button type="button" className={styles.more} onClick={() => onSeeEndpoints(connection.to)}>
          See all endpoints for {connection.to} →
        </button>
      )}
    </article>
  )
}
