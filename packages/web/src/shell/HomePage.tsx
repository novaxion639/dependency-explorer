import { useMemo, useState } from 'react'
import { NavLink, useNav } from './NavLink'
import { searchEntries, type SearchEntry } from '../utils/searchIndex'
import { EXAMPLES, HOME_TILES } from './home'
import styles from './HomePage.module.css'
import { SkTextField } from '@skelloapp/skello-ds-web'

export function HomePage({ index }: { index: SearchEntry[] }) {
  const { onNavigate } = useNav()
  const [query, setQuery] = useState('')
  const results = useMemo(() => (query.trim() ? searchEntries(index, query, 8) : []), [index, query])
  return (
    <div className={styles.home}>
      <SkTextField
        fullWidth
        placeholder="What do you want to know?"
        slotProps={{ htmlInput: { 'aria-label': 'What do you want to know?' } }}
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
              <NavLink patch={r.patch} color="inherit" underline="none">
                <b>{r.label}</b> <span>{r.type}</span>
                <small>{r.sublabel}</small>
              </NavLink>
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
            <NavLink patch={t.patch} color="inherit" underline="none"><b>{t.title}</b><span>{t.blurb}</span></NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
