import type { ResourceRelation } from '@dependency-explorer/data'
import { allResourceRelations, connectivityMap, DatadogOverlaySchema, inRailsOrder, listenerSurface, resourceImpact, resourceNotes, resourceSurface } from '@dependency-explorer/data'
import { useOverlay } from '../../hooks/useOverlay'
import { evidenceHref } from '../../utils/evidenceLink'
import { plural } from '../../utils/plural'
import { CascadeSection } from './CascadeSection'
import { ListenersSection } from './ListenersSection'
import type { ListenerUrl } from './listenerView'
import styles from './ResourcePage.module.css'
import { WritePathsSection } from './WritePathsSection'
import { SkButton } from '@skelloapp/skello-ds-web'
import { NavLink } from '../../shell/NavLink'
import { filePatch, flowPatch, resourcePatch, selectServicePatch } from '../../hooks/useUrlState'
import { NavChip } from '../../shell/NavLink'

const serviceNames = new Set(connectivityMap.services.map(s => s.name))

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
  { relation: 'feeds', label: 'Feeds' },
]

interface Props {
  id: string
  onBlast: (id: string) => void
  listeners: ListenerUrl
  onListeners: (p: Partial<ListenerUrl>) => void
}

export function ResourcePage({ id, onBlast, listeners, onListeners }: Props) {
  const overlay = useOverlay('datadog', DatadogOverlaySchema)
  const impact = resourceImpact(id, connectivityMap, resourceSurface.resources, allResourceRelations)
  if (!impact) {
    return null
  }
  const { resource, byService, flows, dlq, counts } = impact
  const note = resourceNotes[id]
  const tableListeners = resource.kind === 'table' ? inRailsOrder(listenerSurface.listeners.filter(l => l.table === id)) : []
  const depth = overlay?.queues[id]
  const dlqDepth = dlq ? overlay?.queues[dlq] : undefined
  const tables = resource.kind === 'database' ? resourceSurface.resources.filter(r => r.id.startsWith(`${id}.`)) : []
  return (
    <section aria-label={resource.name} className={styles.page}>
      <header className={styles.head}>
        <h1>{resource.name}</h1>
        <p className={styles.meta}>
          {resource.kind} · {resource.store}{resource.owner ? <> · owned by {serviceNames.has(resource.owner) ? <NavLink patch={selectServicePatch(resource.owner)}>{resource.owner}</NavLink> : `${resource.owner} (not in the map)`}</> : null} · evidence {resource.evidence.map((e, i) => {
            const href = evidenceHref(e, resourceSurface.pins)
            return <span key={e}>{i > 0 && ', '}{href ? <a href={href} target="_blank" rel="noreferrer">{e}</a> : e}</span>
          })}
        </p>
        {note?.description && <p className={styles.note}>{note.description}</p>}
        {depth && <p className={styles.meta}>Depth: {depth.depthNow} now, {depth.depthMax14d} max over 14 days</p>}
        <p className={styles.counts}>{plural(counts.services, 'service')} · {plural(counts.files, 'file')} · {plural(counts.flows, 'flow')}</p>
        <SkButton variant="outlined" size="small" color="error" className={styles.impact} onClick={() => onBlast(id)}>If this is down…</SkButton>
      </header>
      {resource.model && (
        <p className={styles.meta}>
          Model <code>{resource.model.className}</code> — <NavLink patch={filePatch(`skello-app/${resource.model.file}`)} className={styles.file}>{resource.model.file}</NavLink>
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
                <NavLink patch={selectServicePatch(g.service)} className={styles.service}>{g.service}</NavLink>
                <span className={styles.count}> {g.rels.length}</span>
                <ul className={styles.rels}>
                  {g.rels.map(r => {
                    const badge = GRADE_BADGE[r.grade]
                    return (
                      <li key={`${r.grade}-${r.file ?? r.service}-${r.target ?? ''}`}>
                        <span title={badge.title} className={styles.grade} data-grade={r.grade}>{badge.symbol}</span>
                        {r.file ? <NavLink patch={filePatch(`${r.service}/${r.file}`)} className={styles.file}>{r.file}</NavLink> : <span className={styles.meta}>{r.grade === 'config' ? 'declared in config' : 'flow edge'}</span>}
                        {r.target && <> → <NavLink patch={resourcePatch(r.target)}>{r.target}</NavLink></>}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </section>
        )
      })}
      <ListenersSection listeners={tableListeners} filters={listeners} open={listeners.listener} onFilters={onListeners} onToggle={listener => onListeners({ listener })} />
      {resource.kind === 'table' && <CascadeSection table={id} event={listeners.event} onEvent={event => onListeners({ event })} />}
      {resource.kind === 'table' && <WritePathsSection table={id} />}
      {dlq && <p className={styles.meta}>Dead letters go to <NavLink patch={resourcePatch(dlq)}>{dlq}</NavLink>{dlqDepth && ` (${dlqDepth.depthNow} waiting)`}</p>}
      {(resource.related ?? []).length > 0 && (
        <section aria-label="Related tables" className={styles.section}>
          <h2>Related tables</h2>
          {(resource.related ?? []).map(t => <NavChip key={t} patch={resourcePatch(t)} label={t.split('.').pop() ?? t} />)}
        </section>
      )}
      {tables.length > 0 && (
        <section aria-label="Tables" className={styles.section}>
          <h2>Tables ({tables.length})</h2>
          {tables.map(t => <NavChip key={t.id} patch={resourcePatch(t.id)} label={t.name} />)}
        </section>
      )}
      {flows.length > 0 && (
        <section aria-label="Flows" className={styles.section}>
          <h2>Flows</h2>
          <ul className={styles.flows}>
            {flows.map(f => <li key={f.flowId}><NavLink patch={flowPatch(f.flowId)}>{f.name}</NavLink> <span className={styles.count}>{f.crud.join(' ')}</span></li>)}
          </ul>
        </section>
      )}
    </section>
  )
}
