import { useState, type ReactNode } from 'react'
import { pagePatch, type UrlState } from '../hooks/useUrlState'
import { breadcrumb } from './crumbs'
import { Breadcrumb } from './Breadcrumb'
import { NavLink } from './NavLink'
import { Rail } from './Rail'
import styles from './AppShell.module.css'
import { SkButton } from '@skelloapp/skello-ds-web'

interface Props {
  url: UrlState
  onNavigate: (patch: Partial<UrlState>, opts?: { push?: boolean }) => void
  onSearch: () => void
  onTogglePresent: () => void
  panel: ReactNode | null
  children: ReactNode
}

export function AppShell({ url, onNavigate, onSearch, onTogglePresent, panel, children }: Props) {
  const [railOpen, setRailOpen] = useState(false)
  const inner = url.page !== 'home'
  const framed = inner && !url.present
  return (
    <div className={styles.shell} data-present={url.present ? 'true' : 'false'}>
      <header className={styles.bar}>
        {framed && (
          <SkButton variant="outlined" size="small" className={styles.menu} aria-expanded={railOpen} onClick={() => setRailOpen(open => !open)}>Menu</SkButton>
        )}
        <NavLink url={url} patch={pagePatch('home')} onNavigate={onNavigate} className={styles.title}>Skello · Dependency Explorer</NavLink>
        <div className={styles.actions}>
          {!url.present && <SkButton variant="outlined" size="small" onClick={onSearch}>Search <kbd>⌘K</kbd></SkButton>}
          <SkButton variant="outlined" size="small" onClick={onTogglePresent}>{url.present ? 'Exit present' : 'Present'}</SkButton>
        </div>
      </header>
      <div className={styles.body}>
        {framed && (
          <div className={styles.railSlot} data-open={railOpen ? 'true' : 'false'}>
            <Rail url={url} onNavigate={patch => { setRailOpen(false); onNavigate(patch) }} />
          </div>
        )}
        <div className={styles.content}>
          <main className={styles.main}>
            {inner && <Breadcrumb url={url} crumbs={breadcrumb(url)} onNavigate={onNavigate} />}
            {children}
          </main>
          {framed && panel && <aside aria-label="Details" className={styles.panel}>{panel}</aside>}
        </div>
      </div>
    </div>
  )
}
