import type { ConnectivityMap, Platform, ProductArea } from '@dependency-explorer/data'
import { areaFacts, getAreaFlows, getAreaServices } from '@dependency-explorer/data'
import { plural } from '../../utils/plural'
import styles from './AreasHome.module.css'

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
    <section aria-label="Product areas" className={styles.page}>
      <header className={styles.head}>
        <h1>Product areas</h1>
        <span className={styles.muted}>Start here: pick an area, follow its reading path.</span>
        <span className={styles.coverage} title="Share of each host repo's source files mapped to an area (pnpm discover 🗺)">
          Code mapped to an area: {Object.entries(areaFacts.coverage).map(([repo, c]) => `${repo} ${c.total ? Math.round((c.mapped / c.total) * 100) : 0}%`).join(' · ')}
        </span>
        <button type="button" className={styles.context} onClick={onOpenContext}>Microservices overview →</button>
      </header>
      <ul className={styles.grid}>
        {product.map(area => {
          const icons = [...new Set(area.codeLocations.map(l => l.platform))].flatMap(p => PLATFORM_ICONS[p] ?? [])
          const owners = (area.owners ?? []).map(o => teamName.get(o) ?? o)
          return (
            <li key={area.id}>
              <button type="button" className={styles.card} style={{ borderLeftColor: area.color }} onClick={() => onOpenArea(area.id)}>
                <span className={styles.cardHead}>
                  <strong>{area.name}</strong>
                  <span aria-hidden="true">{icons.join(' ')}</span>
                </span>
                <span className={styles.description}>{area.description}</span>
                <span className={styles.facts}>
                  <span>{plural(getAreaFlows(area, map.flows, areas).length, 'flow')}</span>
                  <span>{plural(getAreaServices(area).length, 'repo')}</span>
                  <span>{plural(mappedFiles(area), 'file')}</span>
                  <span>{owners.length ? owners.join(', ') : 'owner unassigned'}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <h2 className={styles.section}>Platform capabilities</h2>
      <ul className={styles.platform}>
        {platform.map(area => (
          <li key={area.id}>
            <button type="button" title={area.description} onClick={() => onOpenArea(area.id)}>{area.name}</button>
          </li>
        ))}
      </ul>
    </section>
  )
}
