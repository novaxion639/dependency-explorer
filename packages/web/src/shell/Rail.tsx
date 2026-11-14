import { pagePatch, type Page } from '../hooks/useUrlState'
import { NavLink, useNav } from './NavLink'
import { RAIL, type RailItem } from './railModules'
import styles from './Rail.module.css'

interface Props { onFollow?: () => void }

function Item({ item, page, onFollow }: { item: RailItem; page: Page } & Props) {
  const target = item.page
  return (
    <li>
      {target ? (
        <NavLink patch={pagePatch(target)} onFollow={onFollow} className={styles.item} color="inherit" underline="none" aria-current={page === target ? 'page' : undefined}>
          <span>{item.label}</span>
          <small>{item.hint}</small>
        </NavLink>
      ) : (
        <span className={styles.heading}>{item.label}<small>{item.hint}</small></span>
      )}
      {item.children && (
        <ul className={styles.children}>
          {item.children.map(child => <Item key={child.label} item={child} page={page} onFollow={onFollow} />)}
        </ul>
      )}
    </li>
  )
}

export function Rail({ onFollow }: Props) {
  const { page } = useNav().url
  return (
    <nav aria-label="Modules" className={styles.rail}>
      {RAIL.map(group => (
        <div key={group.title} role="group" aria-label={group.title}>
          <h2 className={styles.group}>{group.title}</h2>
          <ul>{group.items.map(item => <Item key={item.label} item={item} page={page} onFollow={onFollow} />)}</ul>
        </div>
      ))}
    </nav>
  )
}
