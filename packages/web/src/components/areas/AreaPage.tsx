import { useEffect, useMemo } from 'react'
import { ReactFlow, Background, BackgroundVariant, type Edge, type Node, type NodeMouseHandler } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { ConnectivityMap, Platform } from '@dependency-explorer/data'
import { areaFacts, getAreaExternals, getAreaFlows, getCrossAreaEdges } from '@dependency-explorer/data'

const PLATFORM_ORDER: Platform[] = ['monolith', 'web', 'mobile', 'tablet', 'superadmin', 'backend']
const PLATFORM_LABEL: Record<Platform, string> = { monolith: 'Monolith', web: 'Web', mobile: 'Mobile', tablet: 'Tablet', superadmin: 'Superadmin', backend: 'Services' }
const SECTION = { marginTop: 18 } as const
const MUTED = { fontSize: 11, color: '#64748b' } as const
const LINK_BUTTON = { background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 } as const
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
        style: { border: `1px solid ${area.color}`, background: '#1a1d27', color: '#e2e8f0', fontSize: 11 },
      })),
      ...others.map((o, i) => {
        const other = areas.find(a => a.id === o)
        return {
          id: `area:${o}`, position: { x: 320, y: i * 56 }, data: { label: other?.name ?? o },
          style: { border: `1px solid ${other?.color ?? '#475569'}`, background: '#13151f', color: '#cbd5e1', fontSize: 11 },
        }
      }),
    ]
    const edges: Edge[] = crossing.map(e => ({
      id: `${e.service}|${e.otherArea}|${e.direction}`,
      source: e.direction === 'out' ? `svc:${e.service}` : `area:${e.otherArea}`,
      target: e.direction === 'out' ? `area:${e.otherArea}` : `svc:${e.service}`,
      label: String(e.count),
      style: { stroke: '#475569' },
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
    <main style={{ flex: 1, overflowY: 'auto', padding: 16, color: '#e2e8f0' }}>
      <button type="button" onClick={onBack} style={{ ...LINK_BUTTON, fontSize: 11, color: '#818cf8' }}>← All areas</button>
      <h1 style={{ fontSize: 18, marginTop: 6, borderLeft: `4px solid ${area.color}`, paddingLeft: 8 }}>{area.name}</h1>
      <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{area.description}</p>
      <p style={{ ...MUTED, marginTop: 4 }}>Owners: {owners.length ? owners.join(', ') : 'unassigned'}</p>

      <section style={SECTION} aria-labelledby="area-what">
        <h2 id="area-what" style={{ fontSize: 13 }}>What it is</h2>
        {area.glossary.length === 0 && <p style={MUTED}>No glossary yet.</p>}
        <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, max-content) 1fr', gap: '4px 12px', fontSize: 12, marginTop: 6 }}>
          {area.glossary.map(g => {
            const base = g.anchor ? repoUrl.get(g.anchor.repo) : undefined
            return (
              <div key={g.term} style={{ display: 'contents' }}>
                <dt id={`term-${g.term}`} style={{ fontWeight: 600, color: g.term === term ? area.color : '#e2e8f0', scrollMarginTop: 24 }}>
                  {g.anchor && base
                    ? <a href={`${base}/blob/HEAD/${g.anchor.path}`} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{g.term} ↗</a>
                    : g.term}
                </dt>
                <dd style={{ color: '#94a3b8' }}>{g.definition}</dd>
              </div>
            )
          })}
        </dl>
      </section>

      <section style={SECTION} aria-labelledby="area-where">
        <h2 id="area-where" style={{ fontSize: 13 }}>Where it lives</h2>
        {PLATFORM_ORDER.map(platform => {
          const locs = area.codeLocations.filter(l => l.platform === platform)
          if (locs.length === 0) {
            return null
          }
          const globs = locs.flatMap(l => l.globs.map(g => ({ repo: l.repo, glob: g, files: counts[`${l.repo}:${g}`] })))
          const repos = [...new Set(locs.map(l => l.repo))]
          const files = globs.reduce((n, g) => n + (g.files ?? 0), 0)
          return (
            <details key={platform} open={globs.length <= OPEN_GLOB_LIMIT} style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 11, color: '#94a3b8', cursor: 'pointer' }}>
                {PLATFORM_LABEL[platform]} — {repos.join(', ')} · {plural(globs.length, 'location')} · {plural(files, 'file')}
              </summary>
              <ul style={{ listStyle: 'none', fontSize: 11, marginTop: 4 }}>
                {globs.map(g => (
                  <li key={`${g.repo}:${g.glob}`} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => onSelectService(g.repo)} style={{ ...LINK_BUTTON, color: '#818cf8', fontSize: 11 }}>{g.repo}</button>
                    <code style={{ color: '#cbd5e1', wordBreak: 'break-all' }}>{g.glob}</code>
                    <span style={{ color: '#64748b' }}>{g.files === undefined ? 'not scanned' : plural(g.files, 'file')}</span>
                  </li>
                ))}
              </ul>
            </details>
          )
        })}
      </section>

      <section style={SECTION} aria-labelledby="area-path">
        <h2 id="area-path" style={{ fontSize: 13 }}>Reading path</h2>
        {area.readingPath.length === 0 && (
          <p style={MUTED}>{flows.length ? 'No reading path yet — the flows below traverse this area but none is curated as a starting point.' : 'No flow yet — this area is on the documentation backlog.'}</p>
        )}
        <ol style={{ paddingLeft: 18, fontSize: 12 }}>
          {area.readingPath.map(r => (
            <li key={r.flowId} style={{ marginTop: 4 }}>
              <button type="button" onClick={() => onOpenFlow(r.flowId)} style={{ ...LINK_BUTTON, color: '#e0761b', fontSize: 12, fontWeight: 600 }}>{flowById.get(r.flowId)?.name ?? r.flowId}</button>
              <span style={{ color: '#94a3b8' }}> — {r.why}</span>
            </li>
          ))}
        </ol>
        <p style={{ ...MUTED, fontSize: 10, marginTop: 4 }}>{plural(flows.length, 'flow')} traverse this area's code.</p>
      </section>

      <section style={SECTION} aria-labelledby="area-map">
        <h2 id="area-map" style={{ fontSize: 13 }}>Map</h2>
        {graph.nodes.length === 0
          ? <p style={MUTED}>No connection crosses into another area.</p>
          : (
            <div style={{ height: Math.max(180, graph.nodes.length * 30), border: '1px solid #2e3250', borderRadius: 8, marginTop: 6 }}>
              <ReactFlow nodes={graph.nodes} edges={graph.edges} fitView onNodeClick={onNodeClick} nodesConnectable={false} proOptions={{ hideAttribution: true }}>
                <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1e2235" />
              </ReactFlow>
            </div>
          )}
      </section>

      <section style={SECTION} aria-labelledby="area-ext">
        <h2 id="area-ext" style={{ fontSize: 13 }}>External systems</h2>
        {externals.length === 0 && <p style={MUTED}>None evidenced in this area's services.</p>}
        <ul style={{ listStyle: 'none', fontSize: 12 }}>
          {externals.map(e => (
            <li key={e.id}><strong>{e.name}</strong> <span style={{ color: '#64748b' }}>· {e.category} — {e.description}</span></li>
          ))}
        </ul>
      </section>
    </main>
  )
}
