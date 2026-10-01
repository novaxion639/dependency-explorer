import type { ConnectivityMap, Platform, ProductArea } from '@dependency-explorer/data'
import { areaFacts, getAreaFlows, getAreaServices } from '@dependency-explorer/data'

const PLATFORM_ICONS: Partial<Record<Platform, string>> = { web: '🖥', mobile: '📱', tablet: '⏱', superadmin: '🛠' }

interface Props {
  map: ConnectivityMap
  onOpenArea: (id: string) => void
  onOpenContext: () => void
}

function mappedFiles(area: ProductArea): number {
  return Object.values(areaFacts.files[area.id] ?? {}).reduce((n, c) => n + c, 0)
}

export function AreasHome({ map, onOpenArea, onOpenContext }: Props) {
  const areas = map.areas ?? []
  const teamName = new Map((map.teams ?? []).map(t => [t.id, t.name]))
  const product = areas.filter(a => a.kind === 'product')
  const platform = areas.filter(a => a.kind === 'platform')
  return (
    <main style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, color: '#e2e8f0' }}>Product areas</h1>
        <span style={{ fontSize: 12, color: '#64748b' }}>Start here: pick an area, follow its reading path.</span>
        <span style={{ fontSize: 11, color: '#64748b', width: '100%' }} title="Share of each host repo's source files mapped to an area (pnpm discover 🗺)">
          Code mapped to an area: {Object.entries(areaFacts.coverage).map(([repo, c]) => `${repo} ${c.total ? Math.round((c.mapped / c.total) * 100) : 0}%`).join(' · ')}
        </span>
        <button type="button" onClick={onOpenContext} style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '1px solid #2e3250', background: 'transparent', color: '#818cf8', cursor: 'pointer' }}>
          System context →
        </button>
      </header>
      <ul style={{ listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
        {product.map(area => {
          const icons = [...new Set(area.codeLocations.map(l => l.platform))].flatMap(p => PLATFORM_ICONS[p] ?? [])
          const owners = (area.owners ?? []).map(o => teamName.get(o) ?? o)
          return (
            <li key={area.id}>
              <button type="button" onClick={() => onOpenArea(area.id)} style={{ width: '100%', height: '100%', textAlign: 'left', padding: 12, borderRadius: 8, background: '#1a1d27', border: `1px solid ${area.color}55`, borderLeft: `4px solid ${area.color}`, cursor: 'pointer', color: '#e2e8f0' }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong style={{ fontSize: 13 }}>{area.name}</strong>
                  <span aria-hidden="true">{icons.join(' ')}</span>
                </span>
                <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', margin: '6px 0', lineHeight: 1.4 }}>{area.description}</span>
                <span style={{ fontSize: 10, color: '#64748b', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span>{getAreaFlows(area, map.flows, areas).length} flows</span>
                  <span>{getAreaServices(area).length} repos</span>
                  <span>{mappedFiles(area)} files</span>
                  <span>{owners.length ? owners.join(', ') : 'owner unassigned'}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <h2 style={{ fontSize: 13, color: '#94a3b8', margin: '18px 0 8px' }}>Platform capabilities</h2>
      <ul style={{ listStyle: 'none', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {platform.map(area => (
          <li key={area.id}>
            <button type="button" onClick={() => onOpenArea(area.id)} title={area.description} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '1px solid #2e3250', background: '#1a1d27', color: '#cbd5e1', cursor: 'pointer' }}>
              {area.name}
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
