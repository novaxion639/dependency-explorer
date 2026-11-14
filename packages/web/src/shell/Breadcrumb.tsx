import type { Crumb } from './crumbs'
import { NavLink } from './NavLink'
import styles from './Breadcrumb.module.css'

export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className={styles.crumbs}>
      <ol>
        {crumbs.map((c, i) => (
          <li key={c.label}>
            {c.patch
              ? <NavLink patch={c.patch} push color="inherit" underline="always">{c.label}</NavLink>
              : <span aria-current={i === crumbs.length - 1 ? 'page' : undefined}>{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}
