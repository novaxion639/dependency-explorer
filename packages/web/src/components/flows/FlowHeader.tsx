import { connectivityMap, getFlowAreas, type FlowLinkKind, type ServiceFlow } from '@dependency-explorer/data'
import { AreaChip } from '../areas/AreaChip'
import styles from './flows.module.css'
import { ArrowLeftIcon, SkAccordion, SkButton } from '@skelloapp/skello-ds-web'
import { NavLink } from '../../shell/NavLink'
import { flowPatch } from '../../hooks/useUrlState'

const LINK_LABEL: Record<FlowLinkKind, string> = {
  continuation: 'continues in',
  'writes-back-to': 'writes back to',
  'same-journey': 'same journey',
  'domain-related': 'related',
}

interface Props {
  flow: ServiceFlow
  onBack: () => void
}

function splitSummary(text: string): { summary: string; rest: string } {
  const end = text.search(/[.!?]\s/)
  return end === -1 ? { summary: text, rest: '' } : { summary: text.slice(0, end + 1), rest: text.slice(end + 2) }
}

export function FlowHeader({ flow, onBack }: Props) {
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
      <SkButton variant="text" size="small" className={styles.back} startIcon={<ArrowLeftIcon />} onClick={onBack}>Back</SkButton>
      <h1>{flow.name}</h1>
      <div className={styles.meta}>
        {flow.trigger && <span className={styles.trigger}>{`👤 ${flow.trigger.actor}${flow.trigger.role ? ` · ${flow.trigger.role}` : ''}`}</span>}
        {getFlowAreas(flow, connectivityMap.areas ?? []).map(a => <AreaChip key={a.id} area={a} primary={a.id === flow.primaryArea} linked />)}
      </div>
      <p className={styles.summary}>{summary}</p>
      {rest && <SkAccordion title="More" className={styles.more} disableGutters slotProps={{ transition: { unmountOnExit: true } }}><p>{rest}</p></SkAccordion>}
      {links.length > 0 && (
        <ul aria-label="Related flows" className={styles.links}>
          {links.map(l => <li key={l.text}><NavLink patch={flowPatch(l.id)}>{l.text}</NavLink></li>)}
        </ul>
      )}
      {flags.length > 0 && <p className={styles.flags}>{flags.map(f => <code key={f}>{`🚩 ${f}`}</code>)}</p>}
      {rules.length > 0 && (
        <SkAccordion title={`Domain rules · ${rules.length}`} className={styles.more} disableGutters slotProps={{ transition: { unmountOnExit: true } }}>
          {rules.map(r => <section key={r.id}><h3>{`📐 ${r.title}`}</h3><p>{r.statement}</p></section>)}
        </SkAccordion>
      )}
    </header>
  )
}
