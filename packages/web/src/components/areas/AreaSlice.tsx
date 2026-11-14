import type { ReactNode } from 'react'
import type { AreaSliceData } from '../../utils/areaSlice'
import styles from './AreaSlice.module.css'
import { CloseButton } from '../CloseButton'
import { ArrowRightIcon, SkButton } from '@skelloapp/skello-ds-web'
import { NavLink } from '../../shell/NavLink'
import { flowPatch, resourcePatch, selectServicePatch } from '../../hooks/useUrlState'

const SHOWN = 12

interface Props {
  slice: AreaSliceData
  onOpenArea: (id: string) => void
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

export function AreaSlice({ slice, onOpenArea, onClose }: Props) {
  const { area, controllers, tables, calls, flows } = slice
  return (
    <article aria-label={`${area.name} slice`} className={styles.slice}>
      <header className={styles.head}>
        <h2>{area.name}</h2>
        <CloseButton onClick={onClose} />
      </header>
      <p className={styles.muted}>{area.description}</p>
      <SkButton size="small" className={styles.open} endIcon={<ArrowRightIcon />} onClick={() => onOpenArea(area.id)}>Open the area page</SkButton>
      <Section title="Controllers" count={controllers.length}>
        {controllers.slice(0, SHOWN).map(c => <li key={c.name}><code>{c.name}</code> <span className={styles.muted}>{`${c.routes} routes`}</span></li>)}
        {controllers.length > SHOWN && <li className={styles.muted}>{`+${controllers.length - SHOWN} more`}</li>}
      </Section>
      <Section title="Tables" count={tables.length}>
        {tables.map(t => <li key={t.id}><NavLink patch={resourcePatch(t.id)}>{t.name}</NavLink></li>)}
      </Section>
      <Section title="Services it calls" count={calls.length}>
        {calls.map(name => <li key={name}><NavLink patch={selectServicePatch(name)}>{name}</NavLink></li>)}
      </Section>
      <Section title="Flows" count={flows.length}>
        {flows.map(f => <li key={f.id}><NavLink patch={flowPatch(f.id)}>{f.name}</NavLink></li>)}
      </Section>
    </article>
  )
}
