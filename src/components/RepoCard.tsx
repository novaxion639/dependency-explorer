import type { Repo, RepoType } from '../types'

const TYPE_COLOR: Record<RepoType, string> = {
  'rails-monolith': 'var(--rails)',
  'rails-microservice': 'var(--rails)',
  'typescript-microservice': 'var(--ts-svc)',
  'vue-frontend': 'var(--vue)',
  'react-native': 'var(--react)',
  'npm-package': 'var(--pkg)',
  'monorepo': 'var(--monorepo)',
  'other': 'var(--other)',
}

const TYPE_BADGE: Record<RepoType, string> = {
  'rails-monolith': 'Rails',
  'rails-microservice': 'Rails µSvc',
  'typescript-microservice': 'TS',
  'vue-frontend': 'Vue',
  'react-native': 'RN',
  'npm-package': 'NPM',
  'monorepo': 'Monorepo',
  'other': 'Other',
}

interface Props {
  repo: Repo
  selected: boolean
  onClick: () => void
}

export function RepoCard({ repo, selected, onClick }: Props) {
  const color = TYPE_COLOR[repo.type]
  const internalCount = repo.internalDependencies.length
  const publishedCount = repo.publishedPackages?.length ?? 0

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
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 13, wordBreak: 'break-word', flex: 1 }}>{repo.name}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
          background: color + '22', color, whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {TYPE_BADGE[repo.type]}
        </span>
      </div>

      {repo.packageJson?.name && repo.packageJson.name !== repo.name && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{repo.packageJson.name}</div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {internalCount > 0 && (
          <span style={{ fontSize: 11, color: 'var(--accent)' }}>
            ↗ {internalCount} internal dep{internalCount !== 1 ? 's' : ''}
          </span>
        )}
        {publishedCount > 0 && (
          <span style={{ fontSize: 11, color: 'var(--monorepo)' }}>
            📦 {publishedCount} package{publishedCount !== 1 ? 's' : ''}
          </span>
        )}
        {repo.gemfile && (
          <span style={{ fontSize: 11, color: 'var(--rails)' }}>💎 Gemfile</span>
        )}
      </div>
    </div>
  )
}
