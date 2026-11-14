import type { FileIndexEntry } from '../../utils/fileIndex'
import styles from './listPage.module.css'
import { NavCard, NavLink } from '../../shell/NavLink'
import { flowPatch, resourcePatch, routePatch } from '../../hooks/useUrlState'

interface Props {
  entry: FileIndexEntry
}

export function FilePage({ entry }: Props) {
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
            <NavCard patch={{ ...flowPatch(flow.id), unit: (flow.codeUnits ?? []).find(u => u.service === entry.service && u.path === entry.path)?.id ?? null }} className={styles.card}>
              <b>{flow.name}</b>
              <small>{(flow.codeUnits ?? []).filter(u => u.service === entry.service && u.path === entry.path).map(u => u.label).join(' · ')}</small>
              <small className={styles.go}>Open in the flow →</small>
            </NavCard>
          </li>
        ))}
      </ul>
      {entry.routes.length > 0 && (
        <section aria-label="Routes served by this file" className={styles.section}>
          <h3>Routes served by this file ({entry.routes.length})</h3>
          <ul>{entry.routes.map(id => <li key={id}><NavLink patch={routePatch(id)} className={styles.link}>{id}</NavLink></li>)}</ul>
        </section>
      )}
      {entry.resources.length > 0 && (
        <section aria-label="Resources this file touches" className={styles.section}>
          <h3>Resources this file touches ({entry.resources.length})</h3>
          <ul>{entry.resources.map(r => <li key={`${r.id}-${r.relation}`}><NavLink patch={resourcePatch(r.id)} className={styles.link}>{r.relation} {r.id}</NavLink></li>)}</ul>
        </section>
      )}
    </section>
  )
}
