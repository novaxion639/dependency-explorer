import type { ConnectivityService } from '../../data/schemas'

interface Props {
  services: ConnectivityService[]
  selected: string | null
  onSelect: (name: string) => void
  search: string
  onSearch: (v: string) => void
}

const TYPE_COLOR: Record<string, string> = {
  'typescript-microservice': '#3178c6',
  'rails-microservice': '#cc342d',
  'rails-monolith': '#cc342d',
  'vue-frontend': '#42b883',
  'react-native': '#61dafb',
}

export function ServiceSidebar({ services, selected, onSelect, search, onSearch }: Props) {
  const filtered = services.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div style={{
      width: 240, borderRight: '1px solid #2e3250', background: '#1a1d27',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      {/* Search */}
      <div style={{ padding: '10px 10px 8px', borderBottom: '1px solid #2e3250' }}>
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Filter services…"
          style={{
            width: '100%', padding: '5px 8px', borderRadius: 5,
            border: '1px solid #2e3250', background: '#0f1117',
            color: '#e2e8f0', fontSize: 12, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Count */}
      <div style={{ padding: '4px 12px', fontSize: 10, color: '#3e4363' }}>
        {filtered.length} service{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* List */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {filtered.map(svc => {
          const isSelected = svc.name === selected
          const color = TYPE_COLOR[svc.type] ?? '#64748b'

          return (
            <button
              key={svc.name}
              onClick={() => onSelect(svc.name)}
              style={{
                width: '100%', padding: '8px 12px', textAlign: 'left',
                background: isSelected ? '#1e2347' : 'none',
                border: 'none', borderLeft: `3px solid ${isSelected ? '#6366f1' : 'transparent'}`,
                cursor: 'pointer', display: 'block',
                transition: 'background 0.1s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: color, flexShrink: 0,
                }} />
                <span style={{ fontSize: 12, fontWeight: isSelected ? 700 : 400, color: isSelected ? '#e2e8f0' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {svc.name}
                </span>
              </div>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ padding: '12px', fontSize: 12, color: '#3e4363' }}>No services match.</div>
        )}
      </div>
    </div>
  )
}
