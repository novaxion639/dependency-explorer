import type { ConnectivityService, Team } from '@dependency-explorer/data'
import styles from './ServiceSidebar.module.css'

interface Props {
  services: ConnectivityService[]
  teams?: Team[]
  selected: string | null
  onSelect: (name: string) => void
  search: string
  onSearch: (v: string) => void
  open: boolean
  onClose: () => void
}

const TYPE_TAG: Record<string, string> = {
  'typescript-microservice': 'TS',
  'rails-microservice': 'RB',
  'rails-monolith': 'RB',
  'vue-frontend': 'VUE',
  'react-native': 'RN',
}

export function ServiceSidebar({ services, teams, selected, onSelect, search, onSearch, open, onClose }: Props) {
  const teamById = new Map((teams ?? []).map(t => [t.id, t]))
  const filtered = services.filter(s => {
    if (search) {
      const q = search.toLowerCase()
      const teamName = s.teamId ? teamById.get(s.teamId)?.name?.toLowerCase() : ''
      if (!s.name.toLowerCase().includes(q) && !teamName?.includes(q)) {
        return false
      }
    }
    return true
  })

  return (
    <nav aria-label="Services" className={`sidebar ${styles.sidebar}`} data-open={open}>
      <button type="button" className={`mobile-only ${styles.close}`} onClick={onClose} aria-label="Close services menu">✕</button>
      <div className={styles.search}>
        <input aria-label="Filter services" value={search} onChange={e => onSearch(e.target.value)} placeholder="Filter by name or team…" />
      </div>
      <p className={styles.count}>{filtered.length} service{filtered.length !== 1 ? 's' : ''}</p>
      <ul className={styles.list}>
        {filtered.map(svc => {
          const team = svc.teamId ? teamById.get(svc.teamId) : undefined
          return (
            <li key={svc.name}>
              <button type="button" aria-current={svc.name === selected ? 'true' : undefined} onClick={() => onSelect(svc.name)}>
                <span className={styles.name}><span className={styles.tag}>{TYPE_TAG[svc.type] ?? '·'}</span>{svc.name}</span>
                {team && <small>{team.name}</small>}
              </button>
            </li>
          )
        })}
      </ul>
      {filtered.length === 0 && <p className={styles.count}>No services match.</p>}
    </nav>
  )
}
