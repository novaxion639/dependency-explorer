import type { UrlState } from '../../hooks/useUrlState'

const LABEL = { area: 'area', term: 'glossary term', flow: 'flow', s: 'service', resource: 'resource' } as const

export function NotFoundBanner({ notFound, onDismiss }: { notFound: NonNullable<UrlState['notFound']>; onDismiss: () => void }) {
  return (
    <div role="alert" style={{ padding: '8px 16px', background: '#ef444418', borderBottom: '1px solid #ef444444', color: '#fca5a5', fontSize: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
      <span>No {LABEL[notFound.param]} named <code>{notFound.value}</code> — the link may be outdated.</span>
      <button type="button" onClick={onDismiss} style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid #ef444466', color: '#fca5a5', borderRadius: 4, fontSize: 11, padding: '2px 8px', cursor: 'pointer' }}>
        Dismiss
      </button>
    </div>
  )
}
