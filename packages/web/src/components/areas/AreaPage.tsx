import { useEffect, useMemo } from 'react'
import type { ConnectivityMap, Platform, ProductArea } from '@dependency-explorer/data'
import { areaFacts, getAreaExternals, getAreaFlows, JiraOverlaySchema } from '@dependency-explorer/data'
import { Diagram } from '../../diagram/Diagram'
import { NO_FOCUS } from '../../diagram/focus'
import { areaCrossing } from '../../diagram/layouts/areaCrossing'
import type { DiagramRef, Renderer } from '../../diagram/model'
import { useOverlay } from '../../hooks/useOverlay'
import { plural } from '../../utils/plural'
import { BugsSection } from './BugsSection'
import styles from './AreaPage.module.css'
import { ArrowLeftIcon, SkAccordion, SkButton } from '@skelloapp/skello-ds-web'
import { NavLink } from '../../shell/NavLink'
import { flowPatch, selectServicePatch } from '../../hooks/useUrlState'

const PLATFORM_ORDER: Platform[] = ['monolith', 'web', 'mobile', 'tablet', 'superadmin', 'backend']
const PLATFORM_LABEL: Record<Platform, string> = { monolith: 'Monolith', web: 'Web', mobile: 'Mobile', tablet: 'Tablet', superadmin: 'Superadmin', backend: 'Services' }
const OPEN_GLOB_LIMIT = 8
const NO_AREAS: ProductArea[] = []

interface Props {
  map: ConnectivityMap
  areaId: string
  term: string | null
  renderer: Renderer
  onRenderer: (renderer: Renderer) => void
  onBack: () => void
  onOpenArea: (id: string) => void
  onSelectService: (name: string) => void
}

export function AreaPage({ map, areaId, term, renderer, onRenderer, onBack, onOpenArea, onSelectService }: Props) {
  const areas = map.areas ?? NO_AREAS
  const area = areas.find(a => a.id === areaId)
  const repoUrl = new Map(map.services.map(s => [s.name, s.repoUrl]))
  const teamName = new Map((map.teams ?? []).map(t => [t.id, t.name]))
  const flowById = new Map(map.flows.map(f => [f.id, f]))
  const jira = useOverlay('jira', JiraOverlaySchema)

  useEffect(() => {
    if (term) {
      document.getElementById(`term-${term}`)?.scrollIntoView({ block: 'center' })
    }
  }, [term, areaId])

  const model = useMemo(() => (area ? areaCrossing(map, area) : null), [area, map])

  if (!area) {
    return null
  }

  const onSelect = (ref: DiagramRef) => {
    if (ref.type === 'area') {
      onOpenArea(ref.id)
    }
    if (ref.type === 'service') {
      onSelectService(ref.name)
    }
  }

  const flows = getAreaFlows(area, map.flows, areas)
  const externals = getAreaExternals(area, map.externals ?? [])
  const counts = areaFacts.files[area.id] ?? {}
  const owners = (area.owners ?? []).map(o => teamName.get(o) ?? o)
  const bugs = jira?.areas[area.id]

  return (
    <section aria-label={area.name} className={styles.page}>
      <SkButton variant="text" size="small" className={styles.back} startIcon={<ArrowLeftIcon />} onClick={onBack}>All areas</SkButton>
      <h1 className={styles.title} style={{ borderLeftColor: area.color }}>{area.name}</h1>
      <p className={styles.description}>{area.description}</p>
      <p className={styles.muted}>Owners: {owners.length ? owners.join(', ') : 'unassigned'}</p>

      <section className={styles.section} aria-labelledby="area-what">
        <h2 id="area-what">What it is</h2>
        {area.glossary.length === 0 && <p className={styles.muted}>No glossary yet.</p>}
        <dl className={styles.glossary}>
          {area.glossary.map(g => {
            const base = g.anchor ? repoUrl.get(g.anchor.repo) : undefined
            return (
              <div key={g.term} className={styles.term}>
                <dt id={`term-${g.term}`} aria-current={g.term === term ? 'true' : undefined}>
                  {g.anchor && base
                    ? <a href={`${base}/blob/HEAD/${g.anchor.path}`} target="_blank" rel="noreferrer">{g.term} ↗</a>
                    : g.term}
                </dt>
                <dd>{g.definition}</dd>
              </div>
            )
          })}
        </dl>
      </section>

      <section className={styles.section} aria-labelledby="area-where">
        <h2 id="area-where">Where it lives</h2>
        {PLATFORM_ORDER.map(platform => {
          const locs = area.codeLocations.filter(l => l.platform === platform)
          if (locs.length === 0) {
            return null
          }
          const globs = locs.flatMap(l => l.globs.map(g => ({ repo: l.repo, glob: g, files: counts[`${l.repo}:${g}`] })))
          const repos = [...new Set(locs.map(l => l.repo))]
          const files = globs.reduce((n, g) => n + (g.files ?? 0), 0)
          return (
            <SkAccordion
              key={platform}
              title={`${PLATFORM_LABEL[platform]} — ${repos.join(', ')} · ${plural(globs.length, 'location')} · ${plural(files, 'file')}`}
              defaultExpanded={globs.length <= OPEN_GLOB_LIMIT}
              className={styles.platform}
              disableGutters
              slotProps={{ transition: { unmountOnExit: true } }}
            >
              <ul>
                {globs.map(g => (
                  <li key={`${g.repo}:${g.glob}`}>
                    <NavLink patch={selectServicePatch(g.repo)} className={styles.link}>{g.repo}</NavLink>
                    <code>{g.glob}</code>
                    <span className={styles.muted}>{g.files === undefined ? 'not scanned' : plural(g.files, 'file')}</span>
                  </li>
                ))}
              </ul>
            </SkAccordion>
          )
        })}
      </section>

      <section className={styles.section} aria-labelledby="area-path">
        <h2 id="area-path">Reading path</h2>
        {area.readingPath.length === 0 && (
          <p className={styles.muted}>{flows.length ? 'No reading path yet — the flows below traverse this area but none is curated as a starting point.' : 'No flow yet — this area is on the documentation backlog.'}</p>
        )}
        <ol className={styles.path}>
          {area.readingPath.map(r => (
            <li key={r.flowId}>
              <NavLink patch={flowPatch(r.flowId)} className={styles.flow}>{flowById.get(r.flowId)?.name ?? r.flowId}</NavLink>
              <span className={styles.muted}> — {r.why}</span>
            </li>
          ))}
        </ol>
        <p className={styles.muted}>{plural(flows.length, 'flow')} traverse this area's code.</p>
      </section>

      <section className={`${styles.section} ${styles.map}`} aria-labelledby="area-map">
        <h2 id="area-map">Map</h2>
        {!model || model.edges.length === 0
          ? <p className={styles.muted}>No connection crosses into another area.</p>
          : <Diagram model={model} focus={NO_FOCUS} renderer={renderer} onRenderer={onRenderer} onSelect={onSelect} filename={`area_${area.id}`} />}
      </section>

      <section className={styles.section} aria-labelledby="area-ext">
        <h2 id="area-ext">External systems</h2>
        {externals.length === 0 && <p className={styles.muted}>None evidenced in this area's services.</p>}
        <ul className={styles.externals}>
          {externals.map(e => (
            <li key={e.id}><strong>{e.name}</strong> <span className={styles.muted}>· {e.category} — {e.description}</span></li>
          ))}
        </ul>
      </section>

      {jira && bugs && <BugsSection area={bugs} snapshotDate={jira.snapshotDate} host={jira.host} now={new Date()} teams={map.teams ?? []} />}
    </section>
  )
}
