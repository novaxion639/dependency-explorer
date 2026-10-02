import type { ResourceRelation } from '@dependency-explorer/data'
import { allResourceRelations, connectivityMap, resourceImpact, resourceNotes, resourceSurface } from '@dependency-explorer/data'

const GRADE_BADGE: Record<ResourceRelation['grade'], { symbol: string; color: string; title: string }> = {
  code: { symbol: '✓', color: '#10b981', title: 'call site at the pinned commit' },
  config: { symbol: '✓', color: '#10b981', title: 'declared in serverless or Terraform config' },
  flow: { symbol: '~', color: '#f59e0b', title: 'authored flow edge — unverified by code' },
}
const SECTIONS: Array<{ relation: ResourceRelation['relation']; label: string }> = [
  { relation: 'writes', label: 'Writers' },
  { relation: 'reads', label: 'Readers' },
  { relation: 'produces', label: 'Producers' },
  { relation: 'consumes', label: 'Consumers' },
]

interface Props {
  id: string
  onOpenResource: (id: string) => void
  onOpenFile: (key: string) => void
  onOpenFlow: (id: string) => void
  onSelectService: (name: string) => void
  onBlast: (id: string) => void
}

export function ResourcePage({ id, onOpenResource, onOpenFile, onOpenFlow, onSelectService, onBlast }: Props) {
  const impact = resourceImpact(id, connectivityMap, resourceSurface.resources, allResourceRelations)
  if (!impact) {
    return null
  }
  const { resource, byService, flows, dlq, counts } = impact
  const note = resourceNotes[id]
  return (
    <main style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
      <header style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, color: '#e2e8f0' }}>{resource.name}</h1>
        <p style={{ fontSize: 11, color: '#64748b' }}>
          {resource.kind} · {resource.store}{resource.owner ? <> · owned by <button type="button" onClick={() => onSelectService(resource.owner ?? '')} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: 0 }}>{resource.owner}</button></> : null} · evidence {resource.evidence.join(', ')}
        </p>
        {note?.description && <p style={{ fontSize: 12, color: '#cbd5e1', marginTop: 6 }}>{note.description}</p>}
        <p style={{ fontSize: 13, color: '#e2e8f0', marginTop: 8 }}>{counts.services} services · {counts.files} files · {counts.flows} flows</p>
        <button type="button" onClick={() => onBlast(id)} style={{ marginTop: 6, fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid #ef444466', background: '#ef444418', color: '#fca5a5', cursor: 'pointer' }}>If this is down…</button>
      </header>
      {resource.model && (
        <p style={{ fontSize: 11, color: '#94a3b8' }}>
          Model <code>{resource.model.className}</code> — <button type="button" onClick={() => onOpenFile(`skello-app/${resource.model?.file ?? ''}`)} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: 0, fontFamily: 'monospace' }}>{resource.model.file}</button>
        </p>
      )}
      {resource.kind === 'table' && <p style={{ fontSize: 10, color: '#64748b' }}>Writers are class-level write calls; instance writes (record.save, update!) appear as readers.</p>}
      {byService.length === 0 && flows.length === 0 && <p style={{ fontSize: 12, color: '#94a3b8' }}>No code, config or flow touches this resource at the pinned commit.</p>}
      {SECTIONS.map(({ relation, label }) => {
        const groups = byService.map(g => ({ service: g.service, rels: g.relations.filter(r => r.relation === relation) })).filter(g => g.rels.length > 0)
        if (!groups.length) {
          return null
        }
        return (
          <section key={relation} aria-label={label} style={{ marginTop: 14 }}>
            <h2 style={{ fontSize: 12, color: '#94a3b8' }}>{label}</h2>
            {groups.map(g => (
              <div key={g.service} style={{ marginTop: 6, background: '#1a1d27', border: '1px solid #2e3250', borderRadius: 6, padding: 8 }}>
                <button type="button" onClick={() => onSelectService(g.service)} style={{ background: 'none', border: 'none', color: '#e2e8f0', fontWeight: 700, fontSize: 12, cursor: 'pointer', padding: 0 }}>{g.service}</button>
                <span style={{ fontSize: 10, color: '#64748b' }}> {g.rels.length}</span>
                <ul style={{ listStyle: 'none', marginTop: 4, overflowX: 'auto' }}>
                  {g.rels.map(r => {
                    const badge = GRADE_BADGE[r.grade]
                    return (
                      <li key={`${r.grade}-${r.file ?? r.service}`} style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                        <span title={badge.title} style={{ color: badge.color, marginRight: 6 }}>{badge.symbol}</span>
                        {r.file ? <button type="button" onClick={() => onOpenFile(`${r.service}/${r.file ?? ''}`)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: 0, fontFamily: 'monospace' }}>{r.file}</button> : <span style={{ color: '#94a3b8' }}>{r.grade === 'config' ? 'declared in config' : 'flow edge'}</span>}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </section>
        )
      })}
      {dlq && <p style={{ marginTop: 12, fontSize: 11, color: '#94a3b8' }}>Dead letters go to <button type="button" onClick={() => onOpenResource(dlq)} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: 0 }}>{dlq}</button></p>}
      {(resource.related ?? []).length > 0 && (
        <section aria-label="Related tables" style={{ marginTop: 14 }}>
          <h2 style={{ fontSize: 12, color: '#94a3b8' }}>Related tables</h2>
          {(resource.related ?? []).map(t => <button key={t} type="button" onClick={() => onOpenResource(t)} style={{ margin: '4px 6px 0 0', fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid #2e3250', background: 'transparent', color: '#cbd5e1', cursor: 'pointer' }}>{t.split('.').pop()}</button>)}
        </section>
      )}
      {flows.length > 0 && (
        <section aria-label="Flows" style={{ marginTop: 14 }}>
          <h2 style={{ fontSize: 12, color: '#94a3b8' }}>Flows</h2>
          <ul style={{ listStyle: 'none' }}>
            {flows.map(f => <li key={f.flowId}><button type="button" onClick={() => onOpenFlow(f.flowId)} style={{ background: 'none', border: 'none', color: '#e0761b', cursor: 'pointer', padding: '2px 0', fontSize: 12 }}>{f.name}</button> <span style={{ fontSize: 10, color: '#64748b' }}>{f.crud.join(' ')}</span></li>)}
          </ul>
        </section>
      )}
    </main>
  )
}
