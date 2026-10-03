import { useEffect, useMemo, useRef, useState } from 'react'
import type { SearchEntry } from '../utils/searchIndex'
import { searchEntries } from '../utils/searchIndex'
import type { UrlState } from '../hooks/useUrlState'
import styles from './SearchModal.module.css'

interface Props {
  index: SearchEntry[]
  onNavigate: (patch: Partial<UrlState>) => void
  onClose: () => void
}

const RESULTS_ID = 'search-results'
const optionId = (i: number) => `search-option-${i}`

export function SearchModal({ index, onNavigate, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => searchEntries(index, query), [index, query])

  useEffect(() => setCursor(0), [query])
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    inputRef.current?.focus()
    return () => opener?.focus()
  }, [])
  useEffect(() => {
    document.getElementById(optionId(cursor))?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const choose = (entry: SearchEntry) => onNavigate(entry.patch)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor(c => Math.min(c + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor(c => Math.max(c - 1, 0))
    } else if (e.key === 'Enter' && results[cursor]) {
      e.preventDefault()
      choose(results[cursor])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'Tab') {
      e.preventDefault()
    }
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.palette} role="dialog" aria-modal="true" aria-label="Search" onKeyDown={onKeyDown}>
        <input
          ref={inputRef}
          role="combobox"
          aria-label="Search"
          aria-expanded={results.length > 0}
          aria-controls={RESULTS_ID}
          aria-activedescendant={results[cursor] ? optionId(cursor) : undefined}
          className={styles.input}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search services, endpoints, connections, flows, queues…"
        />
        <div className={styles.results}>
          <div id={RESULTS_ID} role="listbox" aria-label="Results">
            {results.map((r, i) => (
              <div
                key={`${r.type}:${r.label}:${i}`}
                id={optionId(i)}
                role="option"
                aria-selected={i === cursor}
                className={styles.row}
                onClick={() => choose(r)}
                onMouseEnter={() => setCursor(i)}
              >
                <span className={styles.type}>{r.type}</span>
                <span className={styles.text}>
                  <b>{r.label}</b>
                  <small>{r.sublabel}</small>
                </span>
              </div>
            ))}
          </div>
          {query && results.length === 0 && <p className={styles.empty}>No match for “{query}”.</p>}
          {!query && (
            <p className={styles.hint}>
              Type to search across {index.length.toLocaleString()} entries — services, endpoints,
              connections, flows, areas, glossary terms, external systems, databases and queues.<br />
              Examples: <Hint q="credit-balance" /> <Hint q="mergeShop" /> <Hint q="svc-users → skello-app" /> <Hint q="shift creation" /> <Hint q="poste" />
            </p>
          )}
        </div>
        <div className={styles.footer}>
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
          <span className={styles.push}>results land on shareable permalinks</span>
        </div>
      </div>
    </>
  )
}

function Hint({ q }: { q: string }) {
  return <code className={styles.example}>{q}</code>
}
