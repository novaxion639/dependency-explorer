import { useEffect, useMemo } from 'react'
import { ReactFlow, Background, BackgroundVariant, type Edge, type Node, type NodeMouseHandler } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { ConnectivityMap, Platform } from '@dependency-explorer/data'
import { areaFacts, getAreaExternals, getAreaFlows, getCrossAreaEdges } from '@dependency-explorer/data'
import styles from './AreaPage.module.css'

const PLATFORM_ORDER: Platform[] = ['monolith', 'web', 'mobile', 'tablet', 'superadmin', 'backend']
const PLATFORM_LABEL: Record<Platform, string> = { monolith: 'Monolith', web: 'Web', mobile: 'Mobile', tablet: 'Tablet', superadmin: 'Superadmin', backend: 'Services' }
const OPEN_GLOB_LIMIT = 8

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

interface Props {
  map: ConnectivityMap
  areaId: string
  term: string | null
  onBack: () => void
  onOpenFlow: (flowId: string) => void
  onOpenArea: (id: string) => void
  onSelectService: (name: string) => void
}

export function AreaPage({ map, areaId, term, onBack, onOpenFlow, onOpenArea, onSelectService }: Props) {
  const areas = map.areas ?? []
  const area = areas.find(a => a.id === areaId)
  const repoUrl = new Map(map.services.map(s => [s.name, s.repoUrl]))
  const teamName = new Map((map.teams ?? []).map(t => [t.id, t.name]))
  const flowById = new Map(map.flows.map(f => [f.id, f]))

  useEffect(() => {
    if (term) {
      document.getElementById(`term-${term}`)?.scrollIntoView({ block: 'center' })
    }
  }, [term, areaId])

  const graph = useMemo(() => {
    if (!area) {
      return { nodes: [], edges: [] }
    }
    const crossing = getCrossAreaEdges(area, map)
    const services = [...new Set(crossing.map(e => e.service))]
    const others = [...new Set(crossing.map(e => e.otherArea))]
    const nodes: Node[] = [
      ...services.map((s, i) => ({
        id: `svc:${s}`, position: { x: 0, y: i * 56 }, data: { label: s },
        style: { border: `1.5px solid ${area.color}`, background: 'var(--card)', color: 'var(--ink)', fontSize: 11 },
      })),
      ...others.map((o, i) => {
        const other = areas.find(a => a.id === o)
        return {
          id: `area:${o}`, position: { x: 320, y: i * 56 }, data: { label: other?.name ?? o },
          style: { border: `1.5px solid ${other?.color ?? 'var(--rule-strong)'}`, background: 'var(--paper-2)', color: 'var(--ink)', fontSize: 11 },
        }
      }),
    ]
    const edges: Edge[] = crossing.map(e => ({
      id: `${e.service}|${e.otherArea}|${e.direction}`,
      source: e.direction === 'out' ? `svc:${e.service}` : `area:${e.otherArea}`,
      target: e.direction === 'out' ? `area:${e.otherArea}` : `svc:${e.service}`,
      label: String(e.count),
      style: { stroke: 'var(--ink-muted)' },
    }))
    return { nodes, edges }
  }, [area, areas, map])

  if (!area) {
    return null
  }

  const onNodeClick: NodeMouseHandler = (_, node) => {
    if (node.id.startsWith('area:')) {
      onOpenArea(node.id.slice('area:'.length))
    } else {
      onSelectService(node.id.slice('svc:'.length))
    }
  }

  const flows = getAreaFlows(area, map.flows, areas)
  const externals = getAreaExternals(area, map.externals ?? [])
  const counts = areaFacts.files[area.id] ?? {}
  const owners = (area.owners ?? []).map(o => teamName.get(o) ?? o)

  return (
    <section aria-label={area.name} className={styles.page}>
      <button type="button" className={styles.back} onClick={onBack}>← All areas</button>
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
            <details key={platform} open={globs.length <= OPEN_GLOB_LIMIT} className={styles.platform}>
              <summary>{PLATFORM_LABEL[platform]} — {repos.join(', ')} · {plural(globs.length, 'location')} · {plural(files, 'file')}</summary>
              <ul>
                {globs.map(g => (
                  <li key={`${g.repo}:${g.glob}`}>
                    <button type="button" className={styles.link} onClick={() => onSelectService(g.repo)}>{g.repo}</button>
                    <code>{g.glob}</code>
                    <span className={styles.muted}>{g.files === undefined ? 'not scanned' : plural(g.files, 'file')}</span>
                  </li>
                ))}
              </ul>
            </details>
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
              <button type="button" className={styles.flow} onClick={() => onOpenFlow(r.flowId)}>{flowById.get(r.flowId)?.name ?? r.flowId}</button>
              <span className={styles.muted}> — {r.why}</span>
            </li>
          ))}
        </ol>
        <p className={styles.muted}>{plural(flows.length, 'flow')} traverse this area's code.</p>
      </section>

      <section className={styles.section} aria-labelledby="area-map">
        <h2 id="area-map">Map</h2>
        {graph.nodes.length === 0
          ? <p className={styles.muted}>No connection crosses into another area.</p>
          : (
            <div className={styles.map} style={{ height: Math.max(180, graph.nodes.length * 30) }}>
              <ReactFlow nodes={graph.nodes} edges={graph.edges} fitView onNodeClick={onNodeClick} nodesConnectable={false} proOptions={{ hideAttribution: true }}>
                <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--rule)" />
              </ReactFlow>
            </div>
          )}
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
    </section>
  )
}
