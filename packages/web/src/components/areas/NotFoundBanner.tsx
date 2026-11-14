import { SkBanner } from '@skelloapp/skello-ds-web'
import type { UrlState } from '../../hooks/useUrlState'

const LABEL = { area: 'area', term: 'glossary term', flow: 'flow', s: 'service', resource: 'resource', blast: 'service or resource' } as const

export function NotFoundBanner({ notFound, onDismiss }: { notFound: NonNullable<UrlState['notFound']>; onDismiss: () => void }) {
  return (
    <SkBanner
      severity="warning"
      direction="row"
      title={<>No {LABEL[notFound.param]} named <code>{notFound.value}</code></>}
      description="The link may be outdated."
      actionLabel="Dismiss"
      actionVariant="text"
      onActionClick={onDismiss}
    />
  )
}
