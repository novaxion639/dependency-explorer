import type { UrlState } from '../../hooks/useUrlState'
import styles from './NotFoundBanner.module.css'

const LABEL = { area: 'area', term: 'glossary term', flow: 'flow', s: 'service', resource: 'resource', blast: 'service or resource' } as const

export function NotFoundBanner({ notFound, onDismiss }: { notFound: NonNullable<UrlState['notFound']>; onDismiss: () => void }) {
  return (
    <div role="alert" className={styles.banner}>
      <span>No {LABEL[notFound.param]} named <code>{notFound.value}</code> — the link may be outdated.</span>
      <button type="button" onClick={onDismiss}>Dismiss</button>
    </div>
  )
}
