import type { UrlState } from '../hooks/useUrlState'
import type { Crumb } from './crumbs'
import { NavLink } from './NavLink'
import styles from './Breadcrumb.module.css'

export function Breadcrumb({ url, crumbs, onNavigate }: { url: UrlState; crumbs: Crumb[]; onNavigate: (patch: Partial<UrlState>, opts?: { push?: boolean }) => void }) {
  return (
    <nav aria-label="Breadcrumb" className={styles.crumbs}>
      <ol>
        {crumbs.map((c, i) => (
          <li key={c.label}>
            {c.patch
              ? <NavLink url={url} patch={c.patch} onNavigate={onNavigate} push>{c.label}</NavLink>
              : <span aria-current={i === crumbs.length - 1 ? 'page' : undefined}>{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}
