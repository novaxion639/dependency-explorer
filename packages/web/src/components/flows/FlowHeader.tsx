import { connectivityMap, getFlowAreas, type FlowLinkKind, type ServiceFlow } from '@dependency-explorer/data'
import { AreaChip } from '../areas/AreaChip'
import styles from './flows.module.css'

const LINK_LABEL: Record<FlowLinkKind, string> = {
  continuation: 'continues in',
  'writes-back-to': 'writes back to',
  'same-journey': 'same journey',
  'domain-related': 'related',
}

interface Props {
  flow: ServiceFlow
  onBack: () => void
  onOpenFlow: (id: string) => void
  onOpenArea: (id: string) => void
}

export function splitSummary(text: string): { summary: string; rest: string } {
  const end = text.search(/[.!?]\s/)
  return end === -1 ? { summary: text, rest: '' } : { summary: text.slice(0, end + 1), rest: text.slice(end + 2) }
}

export function FlowHeader({ flow, onBack, onOpenFlow, onOpenArea }: Props) {
  const { summary, rest } = splitSummary(flow.description)
  const names = new Map(connectivityMap.flows.map(f => [f.id, f.name]))
  const links = [
    ...(flow.links ?? []).map(l => ({ id: l.to, text: `${LINK_LABEL[l.kind]} → ${names.get(l.to) ?? l.to}` })),
    ...connectivityMap.flows.flatMap(f => (f.links ?? []).filter(l => l.to === flow.id).map(l => ({ id: f.id, text: `← ${LINK_LABEL[l.kind]} ${f.name}` }))),
  ]
  const flags = [...new Set([...(flow.codeUnits ?? []).flatMap(u => u.flags ?? []), ...(flow.codeEdges ?? []).flatMap(e => e.flags ?? [])].map(f => f.name))]
  const ruleIds = new Set([...flow.steps.flatMap(s => s.ruleRefs ?? []), ...(flow.codeUnits ?? []).flatMap(u => u.ruleRefs ?? [])])
  const rules = (connectivityMap.rules ?? []).filter(r => ruleIds.has(r.id))
  return (
    <header className={styles.header}>
      <button type="button" className={styles.back} onClick={onBack}>← Back</button>
      <h1>{flow.name}</h1>
      <div className={styles.meta}>
        {flow.trigger && <span className={styles.trigger}>{`👤 ${flow.trigger.actor}${flow.trigger.role ? ` · ${flow.trigger.role}` : ''}`}</span>}
        {getFlowAreas(flow, connectivityMap.areas ?? []).map(a => <AreaChip key={a.id} area={a} primary={a.id === flow.primaryArea} onClick={() => onOpenArea(a.id)} />)}
      </div>
      <p className={styles.summary}>{summary}</p>
      {rest && <details className={styles.more}><summary>more</summary><p>{rest}</p></details>}
      {links.length > 0 && (
        <ul aria-label="Related flows" className={styles.links}>
          {links.map(l => <li key={l.text}><button type="button" onClick={() => onOpenFlow(l.id)}>{l.text}</button></li>)}
        </ul>
      )}
      {flags.length > 0 && <p className={styles.flags}>{flags.map(f => <code key={f}>{`🚩 ${f}`}</code>)}</p>}
      {rules.length > 0 && (
        <details className={styles.more}>
          <summary>{`Domain rules · ${rules.length}`}</summary>
          {rules.map(r => <section key={r.id}><h3>{`📐 ${r.title}`}</h3><p>{r.statement}</p></section>)}
        </details>
      )}
    </header>
  )
}
