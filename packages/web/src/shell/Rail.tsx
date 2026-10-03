import type { Page, UrlState } from '../hooks/useUrlState'
import { RAIL, type RailItem } from './railModules'
import styles from './Rail.module.css'

interface Props { page: Page; onNavigate: (patch: Partial<UrlState>) => void }

function Item({ item, page, onNavigate }: { item: RailItem; page: Page; onNavigate: Props['onNavigate'] }) {
  const target = item.page
  return (
    <li>
      {target ? (
        <button type="button" className={styles.item} aria-current={page === target ? 'page' : undefined} onClick={() => onNavigate({ page: target })}>
          <span>{item.label}</span>
          <small>{item.hint}</small>
        </button>
      ) : (
        <span className={styles.heading}>{item.label}<small>{item.hint}</small></span>
      )}
      {item.children && (
        <ul className={styles.children}>
          {item.children.map(child => <Item key={child.label} item={child} page={page} onNavigate={onNavigate} />)}
        </ul>
      )}
    </li>
  )
}

export function Rail({ page, onNavigate }: Props) {
  return (
    <nav aria-label="Modules" className={styles.rail}>
      {RAIL.map(group => (
        <section key={group.title} aria-label={group.title}>
          <h2 className={styles.group}>{group.title}</h2>
          <ul>{group.items.map(item => <Item key={item.label} item={item} page={page} onNavigate={onNavigate} />)}</ul>
        </section>
      ))}
    </nav>
  )
}
