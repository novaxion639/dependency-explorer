import { useState, type ReactNode } from 'react'
import type { UrlState } from '../hooks/useUrlState'
import { breadcrumb } from './crumbs'
import { Breadcrumb } from './Breadcrumb'
import { Rail } from './Rail'
import styles from './AppShell.module.css'

interface Props {
  url: UrlState
  onNavigate: (patch: Partial<UrlState>) => void
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
          <button type="button" className={styles.menu} aria-expanded={railOpen} onClick={() => setRailOpen(open => !open)}>Menu</button>
        )}
        <button type="button" className={styles.title} onClick={() => onNavigate({ page: 'home' })}>Skello · Dependency Explorer</button>
        <div className={styles.actions}>
          {!url.present && <button type="button" onClick={onSearch}>Search <kbd>⌘K</kbd></button>}
          <button type="button" onClick={onTogglePresent}>{url.present ? 'Exit present' : 'Present'}</button>
        </div>
      </header>
      <div className={styles.body}>
        {framed && (
          <div className={styles.railSlot} data-open={railOpen ? 'true' : 'false'}>
            <Rail page={url.page} onNavigate={patch => { setRailOpen(false); onNavigate(patch) }} />
          </div>
        )}
        <main className={styles.main}>
          {inner && <Breadcrumb crumbs={breadcrumb(url)} onNavigate={onNavigate} />}
          {children}
        </main>
        {framed && panel && <aside aria-label="Details" className={styles.panel}>{panel}</aside>}
      </div>
    </div>
  )
}
