import { useState, useMemo } from 'react'
import rawData from './data/dependency-map.json'
import type { DependencyMap, Repo, SharedPackage, RepoType, PackageCategory } from './types'
import { RepoCard } from './components/RepoCard'
import { PackageCard } from './components/PackageCard'
import { DetailPanel } from './components/DetailPanel'
import { StatsBar } from './components/StatsBar'
import { GraphView } from './components/GraphView'

const data = rawData as DependencyMap

const REPO_TYPE_LABELS: Record<RepoType, string> = {
  'rails-monolith': 'Rails Monolith',
  'rails-microservice': 'Rails µSvc',
  'typescript-microservice': 'TS µSvc',
  'vue-frontend': 'Vue Frontend',
  'react-native': 'React Native',
  'npm-package': 'NPM Package',
  monorepo: 'Monorepo',
  other: 'Other',
}

const PKG_CATEGORY_LABELS: Record<PackageCategory, string> = {
  auth: 'Auth',
  infrastructure: 'Infrastructure',
  sdk: 'SDK',
  'shared-lib': 'Shared Lib',
  ui: 'UI',
  tooling: 'Tooling',
}

export type Selection =
  | { kind: 'repo'; item: Repo }
  | { kind: 'package'; item: SharedPackage }
  | null

type MainView = 'repos' | 'packages' | 'graph'

export default function App() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<RepoType | ''>('')
  const [catFilter, setCatFilter] = useState<PackageCategory | ''>('')
  const [mainView, setMainView] = useState<MainView>('repos')
  const [selection, setSelection] = useState<Selection>(null)

  const filteredRepos = useMemo(() => {
    return data.repos.filter(r => {
      if (typeFilter && r.type !== typeFilter) return false
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [search, typeFilter])

  const filteredPackages = useMemo(() => {
    return data.sharedPackages.filter(p => {
      if (catFilter && p.category !== catFilter) return false
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [search, catFilter])

  const repoTypes = useMemo(
    () => [...new Set(data.repos.map(r => r.type))].sort() as RepoType[],
    [],
  )
  const pkgCategories = useMemo(
    () => [...new Set(data.sharedPackages.map(p => p.category))].sort() as PackageCategory[],
    [],
  )

  const showTypeFilter = mainView === 'repos' || mainView === 'graph'
  const showCatFilter = mainView === 'packages' || mainView === 'graph'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <StatsBar data={data} />

      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 8, padding: '8px 16px',
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        {/* View toggle */}
        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {(['repos', 'packages', 'graph'] as const).map(v => (
            <button key={v} onClick={() => setMainView(v)} style={{
              padding: '4px 14px', cursor: 'pointer', fontSize: 13, border: 'none',
              borderRight: v !== 'graph' ? '1px solid var(--border)' : 'none',
              background: mainView === v ? 'var(--accent)' : 'transparent',
              color: mainView === v ? '#fff' : 'var(--text-muted)',
            }}>
              {v === 'repos' ? `Repos (${data.repos.length})`
                : v === 'packages' ? `Packages (${data.sharedPackages.length})`
                : '⬡ Graph'}
            </button>
          ))}
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={mainView === 'graph' ? 'Highlight nodes…' : 'Search…'}
          style={{
            flex: '1 1 200px', padding: '4px 10px', borderRadius: 6,
            border: '1px solid var(--border)', background: 'var(--surface2)',
            color: 'var(--text)', fontSize: 13, outline: 'none',
          }}
        />

        {showTypeFilter && (
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as RepoType | '')}
            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13 }}
          >
            <option value="">All repo types</option>
            {repoTypes.map(t => <option key={t} value={t}>{REPO_TYPE_LABELS[t]}</option>)}
          </select>
        )}

        {showCatFilter && (
          <select
            value={catFilter}
            onChange={e => setCatFilter(e.target.value as PackageCategory | '')}
            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13 }}
          >
            <option value="">All pkg categories</option>
            {pkgCategories.map(c => <option key={c} value={c}>{PKG_CATEGORY_LABELS[c]}</option>)}
          </select>
        )}

        {(search || typeFilter || catFilter) && (
          <button
            onClick={() => { setSearch(''); setTypeFilter(''); setCatFilter('') }}
            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Graph view — takes full width minus detail panel */}
        {mainView === 'graph' && (
          <GraphView
            data={data}
            search={search}
            typeFilter={typeFilter}
            catFilter={catFilter}
            selection={selection}
            onSelect={setSelection}
          />
        )}

        {/* List views */}
        {mainView !== 'graph' && (
          <div style={{
            flex: 1, overflowY: 'auto', padding: 16,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 10, alignContent: 'start',
          }}>
            {mainView === 'repos'
              ? filteredRepos.map(repo => (
                  <RepoCard
                    key={repo.name}
                    repo={repo}
                    selected={selection?.kind === 'repo' && selection.item.name === repo.name}
                    onClick={() => setSelection(s =>
                      s?.kind === 'repo' && s.item.name === repo.name ? null : { kind: 'repo', item: repo },
                    )}
                  />
                ))
              : filteredPackages.map(pkg => (
                  <PackageCard
                    key={pkg.name}
                    pkg={pkg}
                    selected={selection?.kind === 'package' && selection.item.name === pkg.name}
                    onClick={() => setSelection(s =>
                      s?.kind === 'package' && s.item.name === pkg.name ? null : { kind: 'package', item: pkg },
                    )}
                  />
                ))
            }
            {mainView === 'repos' && filteredRepos.length === 0 && (
              <p style={{ color: 'var(--text-muted)', gridColumn: '1/-1' }}>No repos match.</p>
            )}
            {mainView === 'packages' && filteredPackages.length === 0 && (
              <p style={{ color: 'var(--text-muted)', gridColumn: '1/-1' }}>No packages match.</p>
            )}
          </div>
        )}

        {/* Detail panel — shared across all views */}
        {selection && (
          <DetailPanel
            selection={selection}
            data={data}
            onClose={() => setSelection(null)}
            onSelectRepo={name => {
              const repo = data.repos.find(r => r.name === name)
              if (repo) {
                setSelection({ kind: 'repo', item: repo })
                if (mainView !== 'graph') setMainView('repos')
              }
            }}
            onSelectPackage={name => {
              const pkg = data.sharedPackages.find(p => p.name === name)
              if (pkg) {
                setSelection({ kind: 'package', item: pkg })
                if (mainView !== 'graph') setMainView('packages')
              }
            }}
          />
        )}
      </div>
    </div>
  )
}
