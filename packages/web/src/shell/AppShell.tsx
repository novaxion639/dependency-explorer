import { useState, type ReactNode } from 'react'
import { pagePatch, type UrlState } from '../hooks/useUrlState'
import { breadcrumb } from './crumbs'
import { Breadcrumb } from './Breadcrumb'
import { NavLink } from './NavLink'
import { Rail } from './Rail'
import styles from './AppShell.module.css'
import { SkAppBar, SkButton, SkKeyboardShortcut, SkToolbar } from '@skelloapp/skello-ds-web'

interface Props {
  url: UrlState
  onSearch: () => void
  onTogglePresent: () => void
  panel: ReactNode | null
  children: ReactNode
}

export function AppShell({ url, onSearch, onTogglePresent, panel, children }: Props) {
  const [railOpen, setRailOpen] = useState(false)
  const inner = url.page !== 'home'
  const framed = inner && !url.present
  return (
    <div className={styles.shell} data-present={url.present ? 'true' : 'false'}>
      <SkAppBar position="static" className={styles.bar}>
        <SkToolbar variant="dense" disableGutters className={styles.toolbar}>
          {framed && (
            <SkButton variant="outlined" size="small" className={styles.menu} aria-expanded={railOpen} onClick={() => setRailOpen(open => !open)}>Menu</SkButton>
          )}
          <NavLink patch={pagePatch('home')} className={styles.title} color="inherit" underline="none">Skello · Dependency Explorer</NavLink>
          <div className={styles.actions}>
            {!url.present && <SkButton variant="outlined" size="small" onClick={onSearch}>Search <SkKeyboardShortcut>⌘K</SkKeyboardShortcut></SkButton>}
            <SkButton variant="outlined" size="small" onClick={onTogglePresent}>{url.present ? 'Exit present' : 'Present'}</SkButton>
          </div>
        </SkToolbar>
      </SkAppBar>
      <div className={styles.body}>
        {framed && (
          <div className={styles.railSlot} data-open={railOpen ? 'true' : 'false'}>
            <Rail onFollow={() => setRailOpen(false)} />
          </div>
        )}
        <div className={styles.content}>
          <main className={styles.main}>
            {inner && <Breadcrumb crumbs={breadcrumb(url)} />}
            {children}
          </main>
          {framed && panel && <aside aria-label="Details" className={styles.panel}>{panel}</aside>}
        </div>
      </div>
    </div>
  )
}
