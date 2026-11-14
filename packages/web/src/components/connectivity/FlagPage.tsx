import type { FlagRegistryEntry } from '../../utils/flagRegistry'
import styles from './listPage.module.css'
import { NavCard } from '../../shell/NavLink'
import { flowPatch } from '../../hooks/useUrlState'

interface Props {
  entry: FlagRegistryEntry
}

export function FlagPage({ entry }: Props) {
  return (
    <section aria-label="Feature flag" className={styles.page}>
      <h1 className={styles.title}><span aria-hidden="true">🚩</span><code>{entry.name}</code><span className={styles.kind}>{entry.kind}</span></h1>
      <p className={styles.meta}>gates {entry.flows.length} flow{entry.flows.length === 1 ? '' : 's'}{entry.scope ? ` · canary scope: ${entry.scope}` : ''}</p>
      <ul className={styles.cards}>
        {entry.flows.map(flow => {
          const gatedEdges = (flow.codeEdges ?? []).filter(e => (e.flags ?? []).some(f => f.name === entry.name))
          const gatedUnits = (flow.codeUnits ?? []).filter(u => (u.flags ?? []).some(f => f.name === entry.name))
          return (
            <li key={flow.id}>
              <NavCard patch={flowPatch(flow.id)} className={styles.card}>
                <b>{flow.name}</b>
                {gatedUnits.map(u => <small key={u.id}>🚩 gates <code>{u.label}</code></small>)}
                {gatedEdges.map(e => <small key={`${e.from}-${e.to}-${e.label ?? ''}`}>🚩 gates <code>{e.label ?? `${e.from} → ${e.to}`}</code>{e.condition ? ` — ${e.condition}` : ''}</small>)}
                <small className={styles.go}>View flow →</small>
              </NavCard>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
