import { codeEdgeGrades, connectivityMap, resourceSurface, type FlowCodeUnit, type FlowInfraNode, type ServiceFlow } from '@dependency-explorer/data'
import { STORE_META } from '../storeTypes'
import { edgeFacts } from './edgeFacts'
import styles from './flows.module.css'
import { machineFacts } from './machineFacts'

const KIND_LABEL: Record<FlowCodeUnit['kind'], string> = {
  controller: 'Controller', service: 'Service', manager: 'Manager', job: 'Background job',
  'model-callback': 'Model callbacks', component: 'UI component', client: 'HTTP client',
}

interface Props {
  flow: ServiceFlow
  id: string
  onOpenFlow: (id: string) => void
  onOpenResource: (id: string) => void
  onClose: () => void
}

function UnitFacts({ unit, flow, onOpenFlow }: { unit: FlowCodeUnit; flow: ServiceFlow; onOpenFlow: (id: string) => void }) {
  const repo = connectivityMap.services.find(s => s.name === unit.service)?.repoUrl
  const pin = resourceSurface.pins[unit.service]
  const href = repo && unit.path ? `${repo}/blob/${pin ?? 'HEAD'}/${unit.path}` : null
  const ruleIds = new Set(unit.ruleRefs ?? [])
  const rules = (connectivityMap.rules ?? []).filter(r => ruleIds.has(r.id))
  const others = unit.path ? connectivityMap.flows.filter(f => f.id !== flow.id && (f.codeUnits ?? []).some(u => u.service === unit.service && u.path === unit.path)) : []
  return (
    <>
      <p className={styles.muted}>{`${KIND_LABEL[unit.kind]} · ${unit.service}`}</p>
      {unit.path && (href
        ? <p><a href={href} target="_blank" rel="noreferrer">{`${unit.path} ↗`}</a>{pin && <span className={styles.muted}>{` @ ${pin.slice(0, 7)}`}</span>}</p>
        : <p><code>{unit.path}</code></p>)}
      {unit.description && <p>{unit.description}</p>}
      {(unit.flags ?? []).length > 0 && <p className={styles.flags}>{(unit.flags ?? []).map(f => <code key={f.name}>{`🚩 ${f.name} · ${f.kind}`}</code>)}</p>}
      {rules.map(r => <section key={r.id}><h3>{`📐 ${r.title}`}</h3><p>{r.statement}</p></section>)}
      {(flow.branches ?? []).filter(b => b.at === unit.id).map(b => (
        <p key={b.id} className={styles.branch}>{['⎇', b.status, b.when, '→', b.outcome].filter(Boolean).join(' ')}</p>
      ))}
      {others.length > 0 && (
        <section>
          <h3>Same file in other flows</h3>
          <ul className={styles.plain}>{others.map(f => <li key={f.id}><button type="button" onClick={() => onOpenFlow(f.id)}>{f.name}</button></li>)}</ul>
        </section>
      )}
    </>
  )
}

function StoreFacts({ store, onOpenResource }: { store: FlowInfraNode; onOpenResource: (id: string) => void }) {
  return (
    <>
      <p className={styles.muted}>{`${STORE_META[store.type].icon} ${STORE_META[store.type].label}`}</p>
      {store.description && <p>{store.description}</p>}
      {(store.resources ?? []).length > 0 && (
        <ul className={styles.plain}>{(store.resources ?? []).map(r => <li key={r}><button type="button" onClick={() => onOpenResource(r)}>{r}</button></li>)}</ul>
      )}
    </>
  )
}

export function UnitDetail({ flow, id, onOpenFlow, onOpenResource, onClose }: Props) {
  const unit = (flow.codeUnits ?? []).find(u => u.id === id)
  const store = (flow.infraNodes ?? []).find(n => n.id === id)
  const labelOf = (ref: string) => (flow.codeUnits ?? []).find(u => u.id === ref)?.label ?? (flow.infraNodes ?? []).find(n => n.id === ref)?.label ?? ref
  const calls = [
    ...(flow.codeEdges ?? []).filter(e => e.to === id).map(e => ({ e, text: `← ${labelOf(e.from)}` })),
    ...(flow.codeEdges ?? []).filter(e => e.from === id).map(e => ({ e, text: `→ ${labelOf(e.to)}` })),
  ]
  const facts = machineFacts(flow, id)
  const title = unit?.label ?? store?.label ?? facts?.title ?? id
  return (
    <article aria-label={title} className={styles.detail}>
      <header className={styles.detailHead}>
        <h2>{title}</h2>
        <button type="button" aria-label="Close" onClick={onClose}>×</button>
      </header>
      {unit && <UnitFacts unit={unit} flow={flow} onOpenFlow={onOpenFlow} />}
      {store && <StoreFacts store={store} onOpenResource={onOpenResource} />}
      {facts && (
        <section>
          <h3>State machine</h3>
          <dl>
            {facts.lines.map((f, i) => (
              <div key={`${i}:${f.label}`}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {calls.length > 0 && (
        <section>
          <h3>{`Calls · ${calls.length}`}</h3>
          <ul className={styles.calls}>
            {calls.map(({ e, text }, i) => (
              <li key={`${i}:${text}`}>
                <b>{text}</b>
                {e.label && <span>{e.label}</span>}
                <span className={styles.muted}>{edgeFacts(flow.id, e, codeEdgeGrades).join(' · ')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
