import type { ConnectivityService } from '@dependency-explorer/data'
import { ServiceStores } from '../components/resources/ServiceStores'
import { map } from './dataIndexes'
import styles from './ServiceHeader.module.css'

interface Props {
  service: ConnectivityService
  onBlast: () => void
  onOpenResource: (id: string) => void
}

export function ServiceHeader({ service, onBlast, onOpenResource }: Props) {
  const team = (map.teams ?? []).find(t => t.id === service.teamId)
  const calls = map.connections.filter(c => c.from === service.name).length
  const calledBy = map.connections.filter(c => c.to === service.name).length
  return (
    <section aria-label="Service" className={styles.header}>
      <div className={styles.identity}>
        <h1>{service.name}</h1>
        {team && <span className={styles.team}>{team.name}</span>}
        {team?.slackChannel && <span className={styles.muted}>{team.slackChannel}</span>}
        {service.repoUrl && <a href={service.repoUrl} target="_blank" rel="noreferrer">repo ↗</a>}
        {service.provenance?.source === 'discovered' && (
          <span className={styles.scanned} title={service.provenance.evidence}>✓ scanned {service.provenance.lastVerified}</span>
        )}
        <p className={styles.description} title={service.description}>{service.description}</p>
      </div>
      <ServiceStores service={service} onOpenResource={onOpenResource} />
      <dl className={styles.counts}>
        <div><dt>calls</dt><dd>{calls}</dd></div>
        <div><dt>called by</dt><dd>{calledBy}</dd></div>
        <div><dt>endpoints</dt><dd>{service.endpoints.length}</dd></div>
      </dl>
      <button type="button" className={styles.impact} onClick={onBlast}>If this is down…</button>
    </section>
  )
}
