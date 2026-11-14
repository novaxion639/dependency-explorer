import type { UrlState } from '../../hooks/useUrlState'
import styles from './NotFoundBanner.module.css'
import { SkButton } from '@skelloapp/skello-ds-web'

const LABEL = { area: 'area', term: 'glossary term', flow: 'flow', s: 'service', resource: 'resource', blast: 'service or resource' } as const

export function NotFoundBanner({ notFound, onDismiss }: { notFound: NonNullable<UrlState['notFound']>; onDismiss: () => void }) {
  return (
    <div role="alert" className={styles.banner}>
      <span>No {LABEL[notFound.param]} named <code>{notFound.value}</code> — the link may be outdated.</span>
      <SkButton variant="text" size="small" color="error" className={styles.dismiss} onClick={onDismiss}>Dismiss</SkButton>
    </div>
  )
}
