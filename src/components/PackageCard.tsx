import type { SharedPackage, PackageCategory } from '../types'

const CAT_COLOR: Record<PackageCategory, string> = {
  auth: 'var(--cat-auth)',
  infrastructure: 'var(--cat-infra)',
  sdk: 'var(--cat-sdk)',
  'shared-lib': 'var(--cat-lib)',
  ui: 'var(--cat-ui)',
  tooling: 'var(--cat-tooling)',
}

interface Props {
  pkg: SharedPackage
  selected: boolean
  onClick: () => void
}

export function PackageCard({ pkg, selected, onClick }: Props) {
  const color = CAT_COLOR[pkg.category]
  const shortName = pkg.name.replace('@skelloapp/', '')

  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? 'var(--surface2)' : 'var(--surface)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 8,
        padding: '10px 12px',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>@skelloapp/</div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{shortName}</div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
          background: color + '22', color, whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {pkg.category}
        </span>
      </div>

      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
        from <span style={{ color: 'var(--text)' }}>{pkg.sourceRepo}</span>
      </div>

      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--accent)' }}>
        used by {pkg.usedBy.length} repo{pkg.usedBy.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
