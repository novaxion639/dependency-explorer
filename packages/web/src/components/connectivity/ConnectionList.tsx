import type { ServiceConnection } from '@dependency-explorer/data'
import styles from './ConnectionList.module.css'

interface Props {
  connections: ServiceConnection[]
  onOpen: (connection: ServiceConnection) => void
  onClose: () => void
}

export function ConnectionList({ connections, onOpen, onClose }: Props) {
  return (
    <article aria-label="Connections" className={styles.list}>
      <header className={styles.head}>
        <h2>{`${connections.length} connections`}</h2>
        <button type="button" aria-label="Close" onClick={onClose}>×</button>
      </header>
      <ul className={styles.rows}>
        {connections.map(c => (
          <li key={`${c.from}~${c.to}~${c.protocol}`}>
            <button type="button" onClick={() => onOpen(c)}>{`${c.from} → ${c.to}`}</button>
            <span className={styles.protocol} data-mode={c.communicationType}>{c.protocol}</span>
            {c.provenance?.source === 'discovered' && <span className={styles.verified}>✓ verified</span>}
          </li>
        ))}
      </ul>
    </article>
  )
}
