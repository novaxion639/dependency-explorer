import { pagePatch, type UrlState } from '../hooks/useUrlState'
import { NavLink } from './NavLink'
import { RAIL, type RailItem } from './railModules'
import styles from './Rail.module.css'

interface Props { url: UrlState; onNavigate: (patch: Partial<UrlState>) => void }

function Item({ item, url, onNavigate }: { item: RailItem } & Props) {
  const target = item.page
  return (
    <li>
      {target ? (
        <NavLink url={url} patch={pagePatch(target)} onNavigate={onNavigate} className={styles.item} aria-current={url.page === target ? 'page' : undefined}>
          <span>{item.label}</span>
          <small>{item.hint}</small>
        </NavLink>
      ) : (
        <span className={styles.heading}>{item.label}<small>{item.hint}</small></span>
      )}
      {item.children && (
        <ul className={styles.children}>
          {item.children.map(child => <Item key={child.label} item={child} url={url} onNavigate={onNavigate} />)}
        </ul>
      )}
    </li>
  )
}

export function Rail({ url, onNavigate }: Props) {
  return (
    <nav aria-label="Modules" className={styles.rail}>
      {RAIL.map(group => (
        <div key={group.title} role="group" aria-label={group.title}>
          <h2 className={styles.group}>{group.title}</h2>
          <ul>{group.items.map(item => <Item key={item.label} item={item} url={url} onNavigate={onNavigate} />)}</ul>
        </div>
      ))}
    </nav>
  )
}
