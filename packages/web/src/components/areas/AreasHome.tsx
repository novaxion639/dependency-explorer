import type { ConnectivityMap, Platform, ProductArea } from '@dependency-explorer/data'
import { areaFacts, getAreaFlows, getAreaServices, getSharedExternals, JiraOverlaySchema } from '@dependency-explorer/data'
import { useOverlay } from '../../hooks/useOverlay'
import { jiraSearchUrl } from '../../utils/jiraSearchUrl'
import { plural } from '../../utils/plural'
import styles from './AreasHome.module.css'
import { ArrowRightIcon, SkButton } from '@skelloapp/skello-ds-web'
import { NavChip } from '../../shell/NavLink'
import { areaPatch } from '../../hooks/useUrlState'

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
  const shared = getSharedExternals(areas, map.externals ?? [])
  const jira = useOverlay('jira', JiraOverlaySchema)
  return (
    <section aria-label="Product areas" className={styles.page}>
      <header className={styles.head}>
        <h1>Product areas</h1>
        <span className={styles.muted}>Start here: pick an area, follow its reading path.</span>
        <span className={styles.coverage} title="Share of each host repo's source files mapped to an area (pnpm discover 🗺)">
          Code mapped to an area: {Object.entries(areaFacts.coverage).map(([repo, c]) => `${repo} ${c.total ? Math.round((c.mapped / c.total) * 100) : 0}%`).join(' · ')}
        </span>
        <SkButton variant="outlined" size="small" className={styles.context} endIcon={<ArrowRightIcon />} onClick={onOpenContext}>Microservices overview</SkButton>
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
      {jira && jira.unmapped.open > 0 && (
        <a className={styles.unmapped} href={jiraSearchUrl(jira.host, jira.unmapped.jql)} target="_blank" rel="noreferrer">Bugs with no product area: {jira.unmapped.open} open</a>
      )}
      <h2 className={styles.section}>Platform capabilities</h2>
      <ul className={styles.platform}>
        {platform.map(area => (
          <li key={area.id}>
            <NavChip patch={areaPatch(area.id)} label={area.name} title={area.description} />
          </li>
        ))}
      </ul>
      {shared.length > 0 && (
        <>
          <h2 className={styles.section}>Shared by every area</h2>
          <ul className={styles.shared}>
            {shared.map(e => (
              <li key={e.id}>
                <b>{e.name}</b>
                <span className={styles.muted}>{[...new Set(e.usedBy.map(u => u.service))].join(' · ')}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
