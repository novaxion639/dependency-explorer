import { useMemo, useState } from 'react'
import type { UrlState } from '../hooks/useUrlState'
import { searchEntries, type SearchEntry } from '../utils/searchIndex'
import { EXAMPLES, HOME_TILES } from './home'
import styles from './HomePage.module.css'

export function HomePage({ index, onNavigate }: { index: SearchEntry[]; onNavigate: (patch: Partial<UrlState>) => void }) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => (query.trim() ? searchEntries(index, query, 8) : []), [index, query])
  return (
    <div className={styles.home}>
      <input
        className={styles.ask}
        aria-label="What do you want to know?"
        placeholder="What do you want to know?"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && results[0]) {
            onNavigate(results[0].patch)
          }
        }}
      />
      {results.length > 0 ? (
        <ul className={styles.results} aria-label="Results">
          {results.map(r => (
            <li key={`${r.type}:${r.label}:${r.sublabel}`}>
              <button type="button" onClick={() => onNavigate(r.patch)}>
                <b>{r.label}</b> <span>{r.type}</span>
                <small>{r.sublabel}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.examples}>
          {EXAMPLES.map(x => <button type="button" key={x} onClick={() => setQuery(x)}>“{x}”</button>)}
        </p>
      )}
      <ul className={styles.tiles}>
        {HOME_TILES.map(t => (
          <li key={t.title}>
            <button type="button" onClick={() => onNavigate(t.patch)}><b>{t.title}</b><span>{t.blurb}</span></button>
          </li>
        ))}
      </ul>
    </div>
  )
}
