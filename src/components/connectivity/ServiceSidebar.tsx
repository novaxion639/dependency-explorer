import type { ConnectivityService, Team, Domain } from '../../data/schemas'

interface Props {
  services: ConnectivityService[]
  teams?: Team[]
  domains?: Domain[]
  selected: string | null
  onSelect: (name: string) => void
  search: string
  onSearch: (v: string) => void
  domainFilter: string | null
  onDomainFilter: (domainId: string | null) => void
}

const TYPE_COLOR: Record<string, string> = {
  'typescript-microservice': '#3178c6',
  'rails-microservice': '#cc342d',
  'rails-monolith': '#cc342d',
  'vue-frontend': '#42b883',
  'react-native': '#61dafb',
}

export function ServiceSidebar({ services, teams, domains, selected, onSelect, search, onSearch, domainFilter, onDomainFilter }: Props) {
  const teamById = new Map((teams ?? []).map(t => [t.id, t]))
  const activeDomain = (domains ?? []).find(d => d.id === domainFilter)
  const domainServiceNames = activeDomain ? new Set(activeDomain.serviceNames) : null

  // Build domain-by-service lookup for search
  const domainByService = new Map<string, string>()
  for (const d of domains ?? []) {
    for (const sn of d.serviceNames) {
      domainByService.set(sn, d.name)
    }
  }

  const filtered = services.filter(s => {
    if (domainServiceNames && !domainServiceNames.has(s.name)) return false
    if (search) {
      const q = search.toLowerCase()
      const teamName = s.teamId ? teamById.get(s.teamId)?.name?.toLowerCase() : ''
      const domainName = domainByService.get(s.name)?.toLowerCase() ?? ''
      if (!s.name.toLowerCase().includes(q) && !teamName?.includes(q) && !domainName.includes(q)) {
        return false
      }
    }
    return true
  })

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
          placeholder="Filter by name, team, domain…"
          style={{
            width: '100%', padding: '5px 8px', borderRadius: 5,
            border: '1px solid #2e3250', background: '#0f1117',
            color: '#e2e8f0', fontSize: 12, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Domain filter */}
      {domains && domains.length > 0 && (
        <div style={{ padding: '4px 10px 2px', borderBottom: '1px solid #2e3250' }}>
          <select
            value={domainFilter ?? ''}
            onChange={e => onDomainFilter(e.target.value || null)}
            style={{
              width: '100%', padding: '4px 6px', borderRadius: 5,
              border: '1px solid #2e3250', background: '#0f1117',
              color: '#e2e8f0', fontSize: 11, outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">All domains</option>
            {domains.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Count */}
      <div style={{ padding: '4px 12px', fontSize: 10, color: '#3e4363' }}>
        {filtered.length} service{filtered.length !== 1 ? 's' : ''}
        {activeDomain && <span> in {activeDomain.name}</span>}
      </div>

      {/* List */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {filtered.map(svc => {
          const isSelected = svc.name === selected
          const color = TYPE_COLOR[svc.type] ?? '#64748b'
          const team = svc.teamId ? teamById.get(svc.teamId) : undefined

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
              {team && (
                <div style={{ fontSize: 9, color: '#4b5563', marginLeft: 14, marginTop: 1 }}>
                  {team.name}
                </div>
              )}
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
