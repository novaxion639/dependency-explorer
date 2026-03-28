import type { DependencyMap, Repo, SharedPackage } from '../types'
import type { Selection } from '../App'

interface Props {
  selection: Selection
  data: DependencyMap
  onClose: () => void
  onSelectRepo: (name: string) => void
  onSelectPackage: (name: string) => void
}

export function DetailPanel({ selection, data, onClose, onSelectRepo, onSelectPackage }: Props) {
  return (
    <div style={{
      width: 360, borderLeft: '1px solid var(--border)', background: 'var(--surface)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px', borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>
          {selection?.kind === 'repo' ? selection.item.name : selection?.item.name}
        </span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'var(--text-muted)',
          cursor: 'pointer', fontSize: 18, lineHeight: 1,
        }}>×</button>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, padding: 14 }}>
        {selection?.kind === 'repo' && (
          <RepoDetail
            repo={selection.item}
            data={data}
            onSelectPackage={onSelectPackage}
            onSelectRepo={onSelectRepo}
          />
        )}
        {selection?.kind === 'package' && (
          <PackageDetail
            pkg={selection.item}
            data={data}
            onSelectRepo={onSelectRepo}
            onSelectPackage={onSelectPackage}
          />
        )}
      </div>
    </div>
  )
}

function RepoDetail({ repo, data, onSelectPackage, onSelectRepo }: {
  repo: Repo
  data: DependencyMap
  onSelectPackage: (name: string) => void
  onSelectRepo: (name: string) => void
}) {
  // which other repos depend on packages published by this repo
  const publishedPackages = repo.publishedPackages ?? []
  const consumers = publishedPackages.length > 0
    ? data.repos.filter(r =>
        r.internalDependencies.some(d => publishedPackages.includes(d))
      )
    : []

  return (
    <>
      <Section title="Type">
        <Chip color="var(--text-muted)">{repo.type}</Chip>
      </Section>

      {repo.packageJson?.name && (
        <Section title="NPM name">
          <code style={{ fontSize: 12 }}>{repo.packageJson.name}</code>
        </Section>
      )}

      {repo.gemfile && (
        <Section title="Gemfile">
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{repo.gemfile}</p>
        </Section>
      )}

      {repo.internalDependencies.length > 0 && (
        <Section title={`Internal dependencies (${repo.internalDependencies.length})`}>
          {repo.internalDependencies.map(dep => {
            const pkg = data.sharedPackages.find(p => p.name === dep)
            return (
              <ChipButton key={dep} onClick={() => pkg && onSelectPackage(dep)} active={!!pkg}>
                {dep.replace('@skelloapp/', '')}
              </ChipButton>
            )
          })}
        </Section>
      )}

      {publishedPackages.length > 0 && (
        <Section title={`Published packages (${publishedPackages.length})`}>
          {publishedPackages.map(pkg => (
            <ChipButton key={pkg} onClick={() => onSelectPackage(pkg)} active>
              {pkg.replace('@skelloapp/', '')}
            </ChipButton>
          ))}
        </Section>
      )}

      {consumers.length > 0 && (
        <Section title={`Consumed by (${consumers.length})`}>
          {consumers.map(r => (
            <ChipButton key={r.name} onClick={() => onSelectRepo(r.name)} active>
              {r.name}
            </ChipButton>
          ))}
        </Section>
      )}

      {Object.keys(repo.externalDependencies).length > 0 && (
        <Section title="Key external dependencies">
          {Object.entries(repo.externalDependencies).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0', borderBottom: '1px solid var(--border)' }}>
              <span>{k}</span>
              <span style={{ color: 'var(--text-muted)' }}>{v}</span>
            </div>
          ))}
        </Section>
      )}
    </>
  )
}

function PackageDetail({ pkg, data, onSelectRepo, onSelectPackage }: {
  pkg: SharedPackage
  data: DependencyMap
  onSelectRepo: (name: string) => void
  onSelectPackage: (name: string) => void
}) {
  const sourceRepo = data.repos.find(r => r.name === pkg.sourceRepo)

  return (
    <>
      <Section title="Category">
        <Chip color="var(--cat-sdk)">{pkg.category}</Chip>
      </Section>

      <Section title="Source repo">
        <ChipButton onClick={() => sourceRepo && onSelectRepo(pkg.sourceRepo)} active={!!sourceRepo}>
          {pkg.sourceRepo}
        </ChipButton>
      </Section>

      <Section title={`Used by (${pkg.usedBy.length})`}>
        {pkg.usedBy.map(repoName => {
          const repo = data.repos.find(r => r.name === repoName)
          return (
            <ChipButton key={repoName} onClick={() => repo && onSelectRepo(repoName)} active={!!repo}>
              {repoName}
            </ChipButton>
          )
        })}
      </Section>

      {/* Other packages from same source repo */}
      {sourceRepo?.publishedPackages && sourceRepo.publishedPackages.length > 1 && (
        <Section title={`Other packages from ${pkg.sourceRepo}`}>
          {sourceRepo.publishedPackages
            .filter(p => p !== pkg.name)
            .map(p => (
              <ChipButton key={p} onClick={() => onSelectPackage(p)} active>
                {p.replace('@skelloapp/', '')}
              </ChipButton>
            ))}
        </Section>
      )}
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {children}
      </div>
    </div>
  )
}

function Chip({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: color + '22', color }}>
      {children}
    </span>
  )
}

function ChipButton({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 12, padding: '2px 8px', borderRadius: 4,
        background: active ? 'var(--surface2)' : 'transparent',
        color: active ? 'var(--accent-hover)' : 'var(--text-muted)',
        border: '1px solid var(--border)',
        cursor: active ? 'pointer' : 'default',
      }}
    >
      {children}
    </button>
  )
}
