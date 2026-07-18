import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { ConnectivityMap, ConnectivityService, Team } from '@dependency-explorer/data'

/**
 * Ownership view — per-team service ownership resolved from CODEOWNERS.
 *
 * A service carries a teamId only when its CODEOWNERS wildcard (`*`) line
 * names exactly one mapped product team (see packages/data/src/teams.ts).
 * Teams without owned services are shown deliberately: the empty cards ARE
 * the adoption argument — coverage grows as teams add CODEOWNERS wildcards,
 * with zero changes needed here.
 */
export function OwnershipPage({
  map,
  focusedTeam,
  onFocusTeam,
  onSelectService,
}: {
  map: ConnectivityMap
  focusedTeam: string | null
  onFocusTeam: (id: string | null) => void
  onSelectService: (name: string) => void
}) {
  const teams = map.teams ?? []

  const { byTeam, owned, unowned } = useMemo(() => {
    const byTeam = new Map<string, ConnectivityService[]>()
    const owned: ConnectivityService[] = []
    const unowned: ConnectivityService[] = []
    for (const svc of map.services) {
      if (svc.teamId) {
        owned.push(svc)
        const list = byTeam.get(svc.teamId) ?? []
        list.push(svc)
        byTeam.set(svc.teamId, list)
      } else {
        unowned.push(svc)
      }
    }
    return { byTeam, owned, unowned }
  }, [map.services])

  const sortedTeams = useMemo(
    () =>
      [...teams].sort((a, b) => {
        const diff = (byTeam.get(b.id)?.length ?? 0) - (byTeam.get(a.id)?.length ?? 0)
        return diff !== 0 ? diff : a.name.localeCompare(b.name)
      }),
    [teams, byTeam],
  )

  const focused = focusedTeam ? teams.find(t => t.id === focusedTeam) ?? null : null

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#12141c', padding: '24px 32px' }}>
      {/* Header + coverage */}
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
          Service ownership
        </h1>
        <p style={{ fontSize: 12, color: '#64748b', margin: '6px 0 0', lineHeight: 1.6, maxWidth: 760 }}>
          Ownership is machine-resolved from each repository's CODEOWNERS: a service is assigned to a
          team when its wildcard (<code style={codeStyle}>*</code>) line names exactly one product team.
          Path-rule frequency is not ownership — process squads (infra, perf, archi) and the team-dev
          catch-all are excluded. Coverage grows automatically as teams adopt CODEOWNERS wildcards;
          nothing here needs to change.
        </p>

        <CoverageBar owned={owned.length} total={map.services.length} />

        {/* Focused team detail OR the all-teams grid */}
        {focused ? (
          <TeamDetail
            team={focused}
            services={byTeam.get(focused.id) ?? []}
            map={map}
            onBack={() => onFocusTeam(null)}
            onSelectService={onSelectService}
          />
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: 12,
                marginTop: 20,
              }}
            >
              {sortedTeams.map(team => (
                <TeamCard
                  key={team.id}
                  team={team}
                  services={byTeam.get(team.id) ?? []}
                  onClick={() => onFocusTeam(team.id)}
                />
              ))}
            </div>

            <UnownedSection services={unowned} onSelectService={onSelectService} />
          </>
        )}
      </div>
    </div>
  )
}

function CoverageBar({ owned, total }: { owned: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((owned / total) * 100)
  return (
    <div style={{ marginTop: 16, maxWidth: 760 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>
          CODEOWNERS coverage
        </span>
        <span style={{ fontSize: 11, color: '#64748b' }}>
          <span style={{ color: '#10b981', fontWeight: 700 }}>{owned}</span> of {total} services
          have a resolved owner ({pct}%)
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: '#2e3250', overflow: 'hidden' }}>
        <div
          style={{
            width: `${Math.max(pct, 1)}%`,
            height: '100%',
            borderRadius: 3,
            background: 'linear-gradient(90deg, #10b981, #34d399)',
          }}
        />
      </div>
    </div>
  )
}

function TeamCard({
  team,
  services,
  onClick,
}: {
  team: Team
  services: ConnectivityService[]
  onClick: () => void
}) {
  const hasServices = services.length > 0
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: 14,
        borderRadius: 8,
        cursor: 'pointer',
        background: hasServices ? '#1a1d27' : '#161822',
        border: hasServices ? '1px solid #6366f155' : '1px solid #2e3250',
        opacity: hasServices ? 1 : 0.75,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: hasServices ? '#e2e8f0' : '#94a3b8' }}>
          {team.name}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '1px 7px',
            borderRadius: 9,
            background: hasServices ? '#6366f122' : '#2e3250',
            color: hasServices ? '#818cf8' : '#64748b',
          }}
        >
          {services.length}
        </span>
      </div>
      <div style={{ fontSize: 10, color: '#4b5563', marginTop: 3, fontFamily: 'monospace' }}>
        {(team.githubTeams ?? []).join(', ')}
      </div>
      {hasServices ? (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {services.map(svc => (
            <div key={svc.name} style={{ fontSize: 11, color: '#a5b4fc' }}>
              {svc.name}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 10, fontSize: 10, color: '#4b5563', fontStyle: 'italic' }}>
          No CODEOWNERS ownership resolved yet
        </div>
      )}
    </button>
  )
}

function TeamDetail({
  team,
  services,
  map,
  onBack,
  onSelectService,
}: {
  team: Team
  services: ConnectivityService[]
  map: ConnectivityMap
  onBack: () => void
  onSelectService: (name: string) => void
}) {
  const domainOf = (name: string) =>
    (map.domains ?? []).find(d => d.serviceNames.includes(name))

  return (
    <div style={{ marginTop: 20 }}>
      <button
        onClick={onBack}
        style={{
          padding: '4px 12px',
          borderRadius: 5,
          fontSize: 11,
          fontWeight: 600,
          border: '1px solid #2e3250',
          cursor: 'pointer',
          background: 'transparent',
          color: '#64748b',
        }}
      >
        ← All teams
      </button>

      <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>{team.name}</h2>
        <span style={{ fontSize: 11, color: '#4b5563', fontFamily: 'monospace' }}>
          {(team.githubTeams ?? []).join(', ')}
        </span>
        {team.slackChannel && (
          <span style={{ fontSize: 11, color: '#64748b' }}>{team.slackChannel}</span>
        )}
        {team.onCallUrl && (
          <a href={team.onCallUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#818cf8' }}>
            on-call ↗
          </a>
        )}
      </div>

      {services.length === 0 ? (
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 16 }}>
          No service resolves to this team from CODEOWNERS. A repository's wildcard line naming{' '}
          <code style={codeStyle}>{(team.githubTeams ?? [])[0] ?? team.id}</code> as its only product
          team will appear here on the next discovery run.
        </p>
      ) : (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {services.map(svc => {
            const outCount = map.connections.filter(c => c.from === svc.name).length
            const inCount = map.connections.filter(c => c.to === svc.name).length
            const domain = domainOf(svc.name)
            return (
              <div
                key={svc.name}
                style={{
                  padding: 16,
                  borderRadius: 8,
                  background: '#1a1d27',
                  border: '1px solid #2e3250',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{svc.name}</span>
                  <span style={{ fontSize: 10, color: '#64748b', padding: '1px 6px', borderRadius: 3, background: '#2e3250' }}>
                    {svc.type}
                  </span>
                  {domain && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3, background: `${domain.color}22`, color: domain.color }}>
                      {domain.name}
                    </span>
                  )}
                  {svc.provenance?.source === 'discovered' && (
                    <span
                      title={svc.provenance.evidence}
                      style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3, background: '#10b98122', color: '#10b981' }}
                    >
                      ✓ scanned {svc.provenance.lastVerified}
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: 11, color: '#64748b' }}>
                    <span><b style={{ color: '#4f6ef7' }}>{outCount}</b> calls</span>
                    <span><b style={{ color: '#818cf8' }}>{inCount}</b> called by</span>
                    <span><b style={{ color: '#6366f1' }}>{svc.endpoints.length}</b> endpoints</span>
                  </span>
                </div>

                <p style={{ fontSize: 11, color: '#94a3b8', margin: '8px 0 0', lineHeight: 1.5 }}>
                  {svc.description}
                </p>

                {(svc.githubTeams ?? []).length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: '#4b5563' }}>CODEOWNERS wildcard:</span>
                    {(svc.githubTeams ?? []).map(gt => {
                      const isOwner = (team.githubTeams ?? []).includes(gt)
                      return (
                        <span
                          key={gt}
                          title={isOwner ? 'Resolved owner (only product team on the wildcard line)' : 'Process squad / functional team — excluded from ownership'}
                          style={{
                            fontSize: 10,
                            fontFamily: 'monospace',
                            padding: '1px 6px',
                            borderRadius: 3,
                            background: isOwner ? '#6366f122' : '#1f2333',
                            color: isOwner ? '#a5b4fc' : '#4b5563',
                            border: isOwner ? '1px solid #6366f155' : '1px solid transparent',
                          }}
                        >
                          {gt}
                        </span>
                      )
                    })}
                  </div>
                )}

                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => onSelectService(svc.name)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 5,
                      fontSize: 11,
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      background: '#6366f1',
                      color: '#fff',
                    }}
                  >
                    Open in graph
                  </button>
                  {svc.repoUrl && (
                    <a
                      href={svc.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: '4px 12px',
                        borderRadius: 5,
                        fontSize: 11,
                        fontWeight: 600,
                        border: '1px solid #2e3250',
                        color: '#818cf8',
                        textDecoration: 'none',
                      }}
                    >
                      repo ↗
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function UnownedSection({
  services,
  onSelectService,
}: {
  services: ConnectivityService[]
  onSelectService: (name: string) => void
}) {
  if (services.length === 0) return null
  return (
    <div style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', margin: 0 }}>
        Services without a resolved owner ({services.length})
      </h2>
      <p style={{ fontSize: 11, color: '#4b5563', margin: '4px 0 12px', maxWidth: 760, lineHeight: 1.5 }}>
        Their CODEOWNERS wildcard names zero product teams, several, or only process squads. Adding a
        single product team to the repository's <code style={codeStyle}>*</code> line claims the
        service here on the next discovery run.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {[...services]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(svc => (
            <button
              key={svc.name}
              onClick={() => onSelectService(svc.name)}
              title={svc.description}
              style={{
                padding: '3px 10px',
                borderRadius: 12,
                fontSize: 11,
                border: '1px solid #2e3250',
                cursor: 'pointer',
                background: '#1a1d27',
                color: '#94a3b8',
              }}
            >
              {svc.name}
            </button>
          ))}
      </div>
    </div>
  )
}

const codeStyle: CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 10,
  padding: '1px 4px',
  borderRadius: 3,
  background: '#2e3250',
  color: '#a5b4fc',
}
