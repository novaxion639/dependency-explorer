import { useEffect, useState, type ReactNode } from 'react'
import type { ServiceEndpoint, RecurringTask } from '@dependency-explorer/data'
import { DB_COLORS } from '../nodes/DatabaseNode'
import styles from './EndpointList.module.css'

interface Props {
  serviceName: string
  endpoints: ServiceEndpoint[]
  recurringTasks?: RecurringTask[]
  highlightId?: string | null
  onClose: () => void
}

function Label({ children }: { children: ReactNode }) {
  return <h4 className={styles.label}>{children}</h4>
}

function statusClass(code: string): string {
  if (code.startsWith('2')) {
    return styles.ok
  }
  return code.startsWith('4') ? styles.warn : styles.err
}

export function EndpointList({ serviceName, endpoints, recurringTasks, highlightId, onClose }: Props) {
  const [open, setOpen] = useState<string | null>(highlightId ?? endpoints[0]?.id ?? null)

  useEffect(() => {
    if (!highlightId) {
      return
    }
    setOpen(highlightId)
    requestAnimationFrame(() => {
      document.getElementById(`ep-row-${highlightId}`)?.scrollIntoView({ block: 'center' })
    })
  }, [highlightId])

  const verified = endpoints.filter(ep => ep.provenance?.source === 'discovered').length

  return (
    <article aria-label="Endpoints" className={styles.list}>
      <header className={styles.head}>
        <div>
          <h2>{serviceName}</h2>
          <p>{endpoints.length} endpoint{endpoints.length !== 1 ? 's' : ''}{verified > 0 && <span className={styles.okText}> · ✓ {verified} code-verified</span>}</p>
        </div>
        <button type="button" aria-label="Close" onClick={onClose}>×</button>
      </header>

      {recurringTasks && recurringTasks.length > 0 && (
        <section className={styles.tasks}>
          <Label>⏰ Recurring tasks</Label>
          <ul>
            {recurringTasks.map(task => (
              <li key={task.name}>
                <b>{task.name}</b> <code>{task.schedule}</code>
                {task.provenance?.source === 'discovered' && <span className={styles.okText} title={`Code-verified ${task.provenance.lastVerified ?? ''} — ${task.provenance.evidence ?? ''}`}> ✓</span>}
                {task.description && <p>{task.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className={styles.endpoints}>
        {endpoints.map(ep => {
          const isOpen = open === ep.id
          return (
            <li key={ep.id} id={`ep-row-${ep.id}`} className={highlightId === ep.id ? styles.highlight : undefined}>
              <button type="button" className={styles.row} aria-expanded={isOpen} onClick={() => setOpen(prev => (prev === ep.id ? null : ep.id))}>
                <span className={styles.method}>{ep.method}</span>
                <code>{ep.path}</code>
                {ep.provenance?.source === 'discovered' && <span className={styles.okText} title={`Code-verified ${ep.provenance.lastVerified ?? ''} — ${ep.provenance.evidence ?? ''}`}>✓</span>}
                <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
              </button>
              {isOpen && (
                <div className={styles.body}>
                  <p className={ep.provenance?.source === 'discovered' ? styles.okText : styles.muted}>
                    {ep.provenance?.source === 'discovered'
                      ? `✓ Code-verified ${ep.provenance.lastVerified ?? ''} — ${ep.provenance.evidence ?? ''}`
                      : 'Manual — not yet matched to code by discovery'}
                  </p>
                  {(ep.awsCalls ?? []).length > 0 && (
                    <>
                      <Label>AWS resources</Label>
                      <ul className={styles.chips}>
                        {(ep.awsCalls ?? []).map(c => {
                          const meta = DB_COLORS[c.type]
                          return <li key={`${c.type}:${c.name}`}>{meta?.icon ?? '💾'} <b>{meta?.label ?? c.type}</b> {c.name}</li>
                        })}
                      </ul>
                    </>
                  )}
                  <Label>Description</Label>
                  <p>{ep.description}</p>
                  <Label>Use case</Label>
                  {ep.useCase ? <p className={styles.muted}><i>{ep.useCase}</i></p> : <p className={styles.todo}>✎ To document — endpoint generated from code; business context not yet written</p>}
                  {ep.params.length > 0 && (
                    <>
                      <Label>Parameters</Label>
                      <ul className={styles.params}>
                        {ep.params.map(p => (
                          <li key={p.name}>
                            <code>{p.name}</code> <span className={styles.tag}>{p.in}</span> <span className={styles.muted}>{p.type}</span>
                            {p.required && <span className={styles.required}> required</span>}
                            <p className={styles.muted}>{p.description}</p>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <Label>Response</Label>
                  <dl className={styles.responses}>
                    {Object.entries(ep.response).map(([code, desc]) => (
                      <div key={code}><dt className={statusClass(code)}>{code}</dt><dd>{desc}</dd></div>
                    ))}
                  </dl>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </article>
  )
}
