import type { UrlState } from '../hooks/useUrlState'
import type { Crumb } from './crumbs'
import styles from './Breadcrumb.module.css'

export function Breadcrumb({ crumbs, onNavigate }: { crumbs: Crumb[]; onNavigate: (patch: Partial<UrlState>, opts?: { push?: boolean }) => void }) {
  return (
    <nav aria-label="Breadcrumb" className={styles.crumbs}>
      <ol>
        {crumbs.map((c, i) => (
          <li key={c.label}>
            {c.patch
              ? <button type="button" onClick={() => onNavigate(c.patch ?? {}, { push: true })}>{c.label}</button>
              : <span aria-current={i === crumbs.length - 1 ? 'page' : undefined}>{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}
