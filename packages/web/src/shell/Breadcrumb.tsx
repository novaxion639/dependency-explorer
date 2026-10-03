import type { UrlState } from '../hooks/useUrlState'
import type { Crumb } from './crumbs'
import styles from './Breadcrumb.module.css'

export function Breadcrumb({ crumbs, onNavigate }: { crumbs: Crumb[]; onNavigate: (patch: Partial<UrlState>) => void }) {
  return (
    <nav aria-label="Breadcrumb" className={styles.crumbs}>
      <ol>
        {crumbs.map(c => (
          <li key={c.label}>
            {c.patch ? <button type="button" onClick={() => onNavigate(c.patch ?? {})}>{c.label}</button> : <span aria-current="page">{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}
