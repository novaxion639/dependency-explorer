import { useEffect, useMemo, useRef, useState } from 'react'
import type { SearchEntry, SearchResultType } from '../utils/searchIndex'
import { searchEntries } from '../utils/searchIndex'
import type { UrlState } from '../hooks/useUrlState'

const TYPE_META: Record<SearchResultType, { label: string; color: string }> = {
  service: { label: 'service', color: '#6366f1' },
  endpoint: { label: 'endpoint', color: '#10b981' },
  connection: { label: 'connection', color: '#4f6ef7' },
  flow: { label: 'flow', color: '#e0761b' },
  domain: { label: 'domain', color: '#8b5cf6' },
  team: { label: 'team', color: '#ec4899' },
  infra: { label: 'infra', color: '#f59e0b' },
}

interface Props {
  index: SearchEntry[]
  onNavigate: (patch: Partial<UrlState>) => void
  onClose: () => void
}

export function SearchModal({ index, onNavigate, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => searchEntries(index, query), [index, query])

  useEffect(() => setCursor(0), [query])
  useEffect(() => inputRef.current?.focus(), [])

  // Keep the active row visible while arrowing through the list
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${cursor}"]`)?.scrollIntoView({ block: 'nearest' })
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
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 199, background: '#00000088' }} />

      {/* Palette */}
      <div
        onKeyDown={onKeyDown}
        style={{
          position: 'fixed', top: 90, left: '50%', transform: 'translateX(-50%)',
          zIndex: 200, width: 620, maxWidth: 'calc(100vw - 40px)',
          background: '#1a1d27', border: '1px solid #2e3250', borderRadius: 12,
          boxShadow: '0 16px 60px #000000aa', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 180px)',
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search services, endpoints, connections, flows, queues…"
          style={{
            padding: '14px 18px', fontSize: 14, background: 'transparent',
            border: 'none', borderBottom: '1px solid #2e3250', outline: 'none',
            color: '#e2e8f0', width: '100%', boxSizing: 'border-box',
          }}
        />

        <div ref={listRef} style={{ overflowY: 'auto', flex: 1 }}>
          {query && results.length === 0 && (
            <div style={{ padding: '18px', fontSize: 13, color: '#64748b' }}>
              No match for “{query}”.
            </div>
          )}
          {results.map((r, i) => {
            const meta = TYPE_META[r.type]
            const active = i === cursor
            return (
              <div
                key={`${r.type}:${r.label}:${i}`}
                data-idx={i}
                onClick={() => choose(r)}
                onMouseEnter={() => setCursor(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 18px', cursor: 'pointer',
                  background: active ? '#242736' : 'transparent',
                  borderLeft: active ? `2px solid ${meta.color}` : '2px solid transparent',
                }}
              >
                <span style={{
                  fontSize: 9, fontWeight: 700, width: 72, textAlign: 'center', flexShrink: 0,
                  padding: '2px 0', borderRadius: 3, textTransform: 'uppercase',
                  background: meta.color + '22', color: meta.color,
                }}>
                  {meta.label}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: 13, color: '#e2e8f0', fontWeight: 600,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {r.label}
                  </div>
                  <div style={{
                    fontSize: 11, color: '#64748b',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {r.sublabel}
                  </div>
                </div>
              </div>
            )
          })}
          {!query && (
            <div style={{ padding: '18px', fontSize: 12, color: '#3e4363', lineHeight: 1.7 }}>
              Type to search across {index.length.toLocaleString()} entries — services, endpoints,
              connections, flows, domains, databases and queues.<br />
              Examples: <Hint q="credit-balance" /> <Hint q="mergeShop" /> <Hint q="svc-users → skello-app" /> <Hint q="shift creation" />
            </div>
          )}
        </div>

        <div style={{
          padding: '7px 18px', borderTop: '1px solid #2e3250', display: 'flex', gap: 14,
          fontSize: 10, color: '#3e4363', background: '#161925',
        }}>
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
          <span style={{ marginLeft: 'auto' }}>results land on shareable permalinks</span>
        </div>
      </div>
    </>
  )
}

function Hint({ q }: { q: string }) {
  return (
    <code style={{
      fontSize: 11, color: '#818cf8', background: '#6366f115',
      padding: '1px 6px', borderRadius: 4, marginRight: 4,
    }}>
      {q}
    </code>
  )
}
