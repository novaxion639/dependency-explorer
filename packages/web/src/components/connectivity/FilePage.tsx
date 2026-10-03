import type { ServiceFlow } from '@dependency-explorer/data'
import type { FileIndexEntry } from '../../utils/fileIndex'
import styles from './listPage.module.css'

interface Props {
  entry: FileIndexEntry
  onSelectFlow: (flow: ServiceFlow) => void
  onOpenRoute: (id: string) => void
  onOpenResource: (id: string) => void
}

export function FilePage({ entry, onSelectFlow, onOpenRoute, onOpenResource }: Props) {
  return (
    <section aria-label="File" className={styles.page}>
      <h1 className={styles.title}><span aria-hidden="true">📄</span><code>{entry.path}</code></h1>
      <p className={styles.meta}>
        {entry.service}
        {entry.labels.length > 0 && <>{' · '}{entry.labels.join(' · ')}</>}
        {' · '}traversed by {entry.flows.length} flow{entry.flows.length === 1 ? '' : 's'}
      </p>
      <ul className={styles.cards}>
        {entry.flows.map(flow => (
          <li key={flow.id}>
            <button type="button" className={styles.card} onClick={() => onSelectFlow(flow)}>
              <b>{flow.name}</b>
              <small>{(flow.codeUnits ?? []).filter(u => u.service === entry.service && u.path === entry.path).map(u => u.label).join(' · ')}</small>
              <small className={styles.go}>View code detail →</small>
            </button>
          </li>
        ))}
      </ul>
      {entry.routes.length > 0 && (
        <section aria-label="Routes served by this file" className={styles.section}>
          <h3>Routes served by this file ({entry.routes.length})</h3>
          <ul>{entry.routes.map(id => <li key={id}><button type="button" className={styles.link} onClick={() => onOpenRoute(id)}>{id}</button></li>)}</ul>
        </section>
      )}
      {entry.resources.length > 0 && (
        <section aria-label="Resources this file touches" className={styles.section}>
          <h3>Resources this file touches ({entry.resources.length})</h3>
          <ul>{entry.resources.map(r => <li key={`${r.id}-${r.relation}`}><button type="button" className={styles.link} onClick={() => onOpenResource(r.id)}>{r.relation} {r.id}</button></li>)}</ul>
        </section>
      )}
    </section>
  )
}
