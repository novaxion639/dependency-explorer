import type { DependencyMap } from '../types'

interface Props { data: DependencyMap }

export function StatsBar({ data }: Props) {
  const typeCounts = data.repos.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div style={{
      display: 'flex', gap: 16, padding: '8px 16px', alignItems: 'center',
      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      flexWrap: 'wrap',
    }}>
      <span style={{ fontWeight: 700, fontSize: 15 }}>Skello Dependency Explorer</span>
      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>·</span>
      <Stat label="Repos" value={data.repos.length} color="var(--text)" />
      <Stat label="TS µSvcs" value={typeCounts['typescript-microservice'] ?? 0} color="var(--ts-svc)" />
      <Stat label="Rails" value={(typeCounts['rails-monolith'] ?? 0) + (typeCounts['rails-microservice'] ?? 0)} color="var(--rails)" />
      <Stat label="Frontends" value={(typeCounts['vue-frontend'] ?? 0) + (typeCounts['react-native'] ?? 0)} color="var(--vue)" />
      <Stat label="Packages" value={data.sharedPackages.length} color="var(--pkg)" />
      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
        Generated {data.metadata.generatedAt} · org:{data.metadata.organization}
      </span>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
      <span style={{ fontSize: 16, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
}
