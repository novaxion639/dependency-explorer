import type { ResourceRelation } from '@dependency-explorer/data'
import { allResourceRelations, connectivityMap, inRailsOrder, listenerSurface, resourceImpact, resourceNotes, resourceSurface } from '@dependency-explorer/data'
import { evidenceHref } from '../../utils/evidenceLink'
import { plural } from '../../utils/plural'
import { ListenersSection } from './ListenersSection'
import type { ListenerUrl } from './listenerView'
import styles from './ResourcePage.module.css'

const GRADE_BADGE: Record<ResourceRelation['grade'], { symbol: string; title: string }> = {
  code: { symbol: '✓', title: 'call site at the pinned commit' },
  config: { symbol: '✓', title: 'declared in serverless or Terraform config' },
  flow: { symbol: '~', title: 'authored flow edge — unverified by code' },
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
  listeners: ListenerUrl
  onListeners: (p: Partial<ListenerUrl>) => void
}

export function ResourcePage({ id, onOpenResource, onOpenFile, onOpenFlow, onSelectService, onBlast, listeners, onListeners }: Props) {
  const impact = resourceImpact(id, connectivityMap, resourceSurface.resources, allResourceRelations)
  if (!impact) {
    return null
  }
  const { resource, byService, flows, dlq, counts } = impact
  const note = resourceNotes[id]
  const tableListeners = resource.kind === 'table' ? inRailsOrder(listenerSurface.listeners.filter(l => l.table === id)) : []
  const tables = resource.kind === 'database' ? resourceSurface.resources.filter(r => r.id.startsWith(`${id}.`)) : []
  return (
    <section aria-label={resource.name} className={styles.page}>
      <header className={styles.head}>
        <h1>{resource.name}</h1>
        <p className={styles.meta}>
          {resource.kind} · {resource.store}{resource.owner ? <> · owned by <button type="button" className={styles.link} onClick={() => onSelectService(resource.owner ?? '')}>{resource.owner}</button></> : null} · evidence {resource.evidence.map((e, i) => {
            const href = evidenceHref(e, resourceSurface.pins)
            return <span key={e}>{i > 0 && ', '}{href ? <a href={href} target="_blank" rel="noreferrer">{e}</a> : e}</span>
          })}
        </p>
        {note?.description && <p className={styles.note}>{note.description}</p>}
        <p className={styles.counts}>{plural(counts.services, 'service')} · {plural(counts.files, 'file')} · {plural(counts.flows, 'flow')}</p>
        <button type="button" className={styles.impact} onClick={() => onBlast(id)}>If this is down…</button>
      </header>
      {resource.model && (
        <p className={styles.meta}>
          Model <code>{resource.model.className}</code> — <button type="button" className={styles.file} onClick={() => onOpenFile(`skello-app/${resource.model?.file ?? ''}`)}>{resource.model.file}</button>
        </p>
      )}
      {resource.kind === 'table' && <p className={styles.hint}>Writers are class-level write calls; instance writes (record.save, update!) appear as readers.</p>}
      {byService.length === 0 && flows.length === 0 && <p className={styles.meta}>No code, config or flow touches this resource at the pinned commit.</p>}
      {SECTIONS.map(({ relation, label }) => {
        const groups = byService.map(g => ({ service: g.service, rels: g.relations.filter(r => r.relation === relation) })).filter(g => g.rels.length > 0)
        if (!groups.length) {
          return null
        }
        return (
          <section key={relation} aria-label={label} className={styles.section}>
            <h2>{label}</h2>
            {groups.map(g => (
              <div key={g.service} className={styles.group}>
                <button type="button" className={styles.service} onClick={() => onSelectService(g.service)}>{g.service}</button>
                <span className={styles.count}> {g.rels.length}</span>
                <ul className={styles.rels}>
                  {g.rels.map(r => {
                    const badge = GRADE_BADGE[r.grade]
                    return (
                      <li key={`${r.grade}-${r.file ?? r.service}`}>
                        <span title={badge.title} className={styles.grade} data-grade={r.grade}>{badge.symbol}</span>
                        {r.file ? <button type="button" className={styles.file} onClick={() => onOpenFile(`${r.service}/${r.file ?? ''}`)}>{r.file}</button> : <span className={styles.meta}>{r.grade === 'config' ? 'declared in config' : 'flow edge'}</span>}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </section>
        )
      })}
      <ListenersSection listeners={tableListeners} filters={listeners} open={listeners.listener} onFilters={onListeners} onToggle={listener => onListeners({ listener })} onOpenResource={onOpenResource} />
      {dlq && <p className={styles.meta}>Dead letters go to <button type="button" className={styles.link} onClick={() => onOpenResource(dlq)}>{dlq}</button></p>}
      {(resource.related ?? []).length > 0 && (
        <section aria-label="Related tables" className={styles.section}>
          <h2>Related tables</h2>
          {(resource.related ?? []).map(t => <button key={t} type="button" className={styles.chip} onClick={() => onOpenResource(t)}>{t.split('.').pop()}</button>)}
        </section>
      )}
      {tables.length > 0 && (
        <section aria-label="Tables" className={styles.section}>
          <h2>Tables ({tables.length})</h2>
          {tables.map(t => <button key={t.id} type="button" className={styles.chip} onClick={() => onOpenResource(t.id)}>{t.name}</button>)}
        </section>
      )}
      {flows.length > 0 && (
        <section aria-label="Flows" className={styles.section}>
          <h2>Flows</h2>
          <ul className={styles.flows}>
            {flows.map(f => <li key={f.flowId}><button type="button" className={styles.link} onClick={() => onOpenFlow(f.flowId)}>{f.name}</button> <span className={styles.count}>{f.crud.join(' ')}</span></li>)}
          </ul>
        </section>
      )}
    </section>
  )
}
