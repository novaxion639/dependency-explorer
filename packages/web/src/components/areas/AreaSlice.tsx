import type { ReactNode } from 'react'
import type { AreaSliceData } from '../../utils/areaSlice'
import styles from './AreaSlice.module.css'

const SHOWN = 12

interface Props {
  slice: AreaSliceData
  onOpenArea: (id: string) => void
  onOpenResource: (id: string) => void
  onSelectService: (name: string) => void
  onOpenFlow: (id: string) => void
  onClose: () => void
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h3>{`${title} · ${count}`}</h3>
      {count ? <ul>{children}</ul> : <p className={styles.muted}>None.</p>}
    </section>
  )
}

export function AreaSlice({ slice, onOpenArea, onOpenResource, onSelectService, onOpenFlow, onClose }: Props) {
  const { area, controllers, tables, calls, flows } = slice
  return (
    <article aria-label={`${area.name} slice`} className={styles.slice}>
      <header className={styles.head}>
        <h2>{area.name}</h2>
        <button type="button" aria-label="Close" onClick={onClose}>×</button>
      </header>
      <p className={styles.muted}>{area.description}</p>
      <button type="button" className={styles.open} onClick={() => onOpenArea(area.id)}>Open the area page →</button>
      <Section title="Controllers" count={controllers.length}>
        {controllers.slice(0, SHOWN).map(c => <li key={c.name}><code>{c.name}</code> <span className={styles.muted}>{`${c.routes} routes`}</span></li>)}
        {controllers.length > SHOWN && <li className={styles.muted}>{`+${controllers.length - SHOWN} more`}</li>}
      </Section>
      <Section title="Tables" count={tables.length}>
        {tables.map(t => <li key={t.id}><button type="button" onClick={() => onOpenResource(t.id)}>{t.name}</button></li>)}
      </Section>
      <Section title="Services it calls" count={calls.length}>
        {calls.map(name => <li key={name}><button type="button" onClick={() => onSelectService(name)}>{name}</button></li>)}
      </Section>
      <Section title="Flows" count={flows.length}>
        {flows.map(f => <li key={f.id}><button type="button" onClick={() => onOpenFlow(f.id)}>{f.name}</button></li>)}
      </Section>
    </article>
  )
}
