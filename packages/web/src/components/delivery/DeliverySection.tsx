import type { DatadogOverlay, DeliveryOverlay } from '@dependency-explorer/data'
import styles from './DeliverySection.module.css'

type Verdict = DatadogOverlay['services'][string]['releases'][number]['verdict']
type Step = DeliveryOverlay['services'][string]['steps'][number]

interface Props {
  delivery: DeliveryOverlay['services'][string]
  verdict: Verdict | null
}

const MAX_TITLE = 48
const VERDICT_LABEL: Record<Verdict, string> = { regressed: 'Regressed', steady: 'Steady', tooRecent: 'Too recent' }
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' })
const shortDay = (iso: string) => dayMonth.format(new Date(iso))
const cut = (title: string) => (title.length > MAX_TITLE ? `${title.slice(0, MAX_TITLE - 1)}…` : title)

function StepItem({ step }: { step: Step }) {
  const { count, branch, oldest } = step
  return (
    <li aria-label={`${count} on ${branch}, oldest ${oldest.title}, ${oldest.workingDays} working days`} title={oldest.title}>
      <strong>{count} on {branch}</strong> · {cut(oldest.title)} · <span className={oldest.workingDays === 0 ? styles.dim : undefined}>{oldest.workingDays} d</span>
    </li>
  )
}

function ReleaseItem({ release, verdict }: { release: Props['delivery']['lastRelease']; verdict: Verdict | null }) {
  if (release === null) {
    return <li aria-label="No release in prod">No release in prod</li>
  }
  const label = [`in prod ${release.version}`, shortDay(release.mergedAt), ...(verdict ? [VERDICT_LABEL[verdict]] : [])].join(', ')
  return (
    <li aria-label={label} title={release.title}>
      <strong>in prod {release.version}</strong> · {shortDay(release.mergedAt)}
      {verdict && <span className={`${styles.verdict} ${styles[verdict]}`}>{VERDICT_LABEL[verdict]}</span>}
    </li>
  )
}

export function DeliverySection({ delivery, verdict }: Props) {
  return (
    <section aria-label="Delivery" className={styles.delivery}>
      <h2>
        Delivery
        {delivery.late && (
          <span className={styles.late} title="Oldest change waiting 3 working days or more">
            Late for prod<span className={styles.hidden}>: oldest change waiting 3 working days or more</span>
          </span>
        )}
      </h2>
      <ol className={styles.line}>
        {delivery.steps.length === 0 && <li aria-label="Nothing on its way to prod" className={styles.dim}>Nothing on its way to prod</li>}
        {delivery.steps.map((step) => <StepItem key={step.branch} step={step} />)}
        <ReleaseItem release={delivery.lastRelease} verdict={verdict} />
      </ol>
      <footer className={styles.footer}>
        {delivery.fetchedAt === null ? 'Branches never fetched by discovery' : `Branches as of ${shortDay(delivery.fetchedAt)}`}
      </footer>
    </section>
  )
}
