import type { JiraOverlay, Team } from '@dependency-explorer/data'
import { jiraSearchUrl } from '../../utils/jiraSearchUrl'
import { isStaleSnapshot } from '../../utils/staleSnapshot'
import { Sparkline } from '../Sparkline'
import styles from './BugsSection.module.css'

interface Props {
  area: JiraOverlay['areas'][string]
  snapshotDate: string
  host: string
  now: Date
  teams: Team[]
}

export function BugsSection({ area, snapshotDate, host, now, teams }: Props) {
  const teamName = new Map(teams.map(t => [t.id, t.name]))
  const featureAreas = [...area.featureAreas].sort((a, b) => b.open - a.open || a.name.localeCompare(b.name))
  return (
    <section aria-label="Bugs" className={styles.bugs}>
      <h2>Bugs</h2>
      <p className={styles.counts}>{area.open} open · {area.breached} past SLA · {area.opened90d} opened in 90 days</p>
      <Sparkline label="BRs opened per week" values={area.weekly} partialNote="the last point is the snapshot week, partial" />
      {featureAreas.length > 0 && (
        <section aria-label="Feature Areas">
          <h3>Feature Areas</h3>
          <ul>
            {featureAreas.map(f => (
              <li key={f.name}>{f.name} <span className={styles.muted}>{f.open} open · {f.breached} past SLA</span></li>
            ))}
          </ul>
        </section>
      )}
      {area.teams.length > 0 && (
        <section aria-label="Teams">
          <h3>Teams</h3>
          <ul>
            {area.teams.map(t => (
              <li key={t.teamId ?? ''}>{t.teamId === null ? 'No team' : teamName.get(t.teamId) ?? t.teamId} <span className={styles.muted}>{t.open} open</span></li>
            ))}
          </ul>
        </section>
      )}
      <a href={jiraSearchUrl(host, area.jql)} target="_blank" rel="noreferrer">Open in Jira</a>
      <footer className={styles.footer}>
        Jira snapshot of {snapshotDate}
        {isStaleSnapshot(snapshotDate, now) && <span className={styles.stale}> · stale</span>}
      </footer>
    </section>
  )
}
