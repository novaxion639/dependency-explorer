import type { ReactNode } from 'react'
import type { DatadogOverlay } from '@dependency-explorer/data'
import { isStaleSnapshot } from '../../utils/staleSnapshot'
import { Sparkline } from '../Sparkline'
import styles from './HealthSection.module.css'

type ServiceHealth = DatadogOverlay['services'][string]

interface Props {
  health: ServiceHealth
  snapshotDate: string
  eventsCapped: boolean
  now: Date
}

const STATE_LABEL: Record<ServiceHealth['state'], string> = {
  problem: 'Problem now',
  dig: 'To dig into',
  fellBack: 'Fell back',
  healthy: 'Healthy',
  noData: 'No data',
}
const VERDICT_LABEL: Record<ServiceHealth['releases'][number]['verdict'], string> = {
  regressed: 'Regressed',
  steady: 'Steady',
  tooRecent: 'Too recent',
}
const PARTIAL_DAY = 'the last point is the snapshot day, partial'
const percent = new Intl.NumberFormat('en', { maximumFractionDigits: 2, roundingMode: 'trunc', useGrouping: false })

function List<T>({ title, items, children }: { title: string; items: T[]; children: (item: T) => ReactNode }) {
  if (items.length === 0) {
    return null
  }
  return (
    <section aria-label={title}>
      <h3>{title}</h3>
      <ul>{items.map(children)}</ul>
    </section>
  )
}

function DatadogLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer">{children}</a>
}

export function HealthSection({ health, snapshotDate, eventsCapped, now }: Props) {
  const stale = isStaleSnapshot(snapshotDate, now)
  return (
    <section aria-label="Health" className={styles.health}>
      <h2>Health</h2>
      <p className={`${styles.state} ${styles[health.state]}`}>
        {STATE_LABEL[health.state]}
        {health.reasons.length > 0 && <span className={styles.reasons}> · {health.reasons.join(' · ')}</span>}
      </p>
      {health.strip.length > 0 && (
        <>
          <div className={styles.strip}>
            <Sparkline label="Requests" values={health.strip.map(d => d.requests)} partialNote={PARTIAL_DAY} />
            <Sparkline label="5xx" values={health.strip.map(d => d.errors5xx)} partialNote={PARTIAL_DAY} />
            <Sparkline label="p95 ms" values={health.strip.map(d => d.p95ms)} partialNote={PARTIAL_DAY} />
          </div>
          <p className={styles.note}>{health.strip[0]?.day} to {health.strip.at(-1)?.day}; the hollow last point is the snapshot day, partial</p>
        </>
      )}
      <List title="Monitors" items={health.monitors}>
        {m => (
          <li key={m.id}>
            <DatadogLink href={m.url}>{m.name}</DatadogLink> <span className={styles.muted}>{m.status}</span>
            {m.noisy && <span className={styles.noisy}>noisy</span>}
          </li>
        )}
      </List>
      <List title="SLOs" items={health.slos}>
        {s => (
          <li key={s.id}>
            <DatadogLink href={s.url}>{s.name}</DatadogLink> <span className={styles.muted}>target {percent.format(s.target)} % · {s.value === null ? 'no value' : `${percent.format(s.value)} %`}</span>
          </li>
        )}
      </List>
      <List title="Incidents" items={health.incidents}>
        {i => (
          <li key={i.id}>
            <DatadogLink href={i.url}>{i.title}</DatadogLink> <span className={styles.muted}>{i.severity}</span>
          </li>
        )}
      </List>
      <List title="Releases" items={health.releases}>
        {r => (
          <li key={r.sha}>
            <span className={`${styles.verdict} ${styles[r.verdict]}`}>{VERDICT_LABEL[r.verdict]}</span> {r.title} <span className={styles.muted}>{r.mergedAt.slice(0, 10)} · {r.sha.slice(0, 7)}</span>
          </li>
        )}
      </List>
      <footer className={styles.footer}>
        Datadog snapshot of {snapshotDate}
        {stale && <span className={styles.stale}> · stale</span>}
        {eventsCapped && <> · Noisy counts may be low</>}
      </footer>
    </section>
  )
}
