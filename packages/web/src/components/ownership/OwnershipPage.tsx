import { useMemo } from 'react'
import type { ConnectivityMap, ConnectivityService, Team } from '@dependency-explorer/data'
import { getServiceLane } from '@dependency-explorer/data'
import { AreaChip } from '../areas/AreaChip'
import styles from './OwnershipPage.module.css'

// A service carries a teamId only when its CODEOWNERS wildcard names exactly one product team;
// teams without services stay visible on purpose — the empty cards are the adoption argument.
export function OwnershipPage({
  map,
  focusedTeam,
  onFocusTeam,
  onSelectService,
  onOpenArea,
}: {
  map: ConnectivityMap
  focusedTeam: string | null
  onFocusTeam: (id: string | null) => void
  onSelectService: (name: string) => void
  onOpenArea: (id: string) => void
}) {
  const teams = map.teams ?? []

  const { byTeam, owned, unowned } = useMemo(() => {
    const byTeam = new Map<string, ConnectivityService[]>()
    const owned: ConnectivityService[] = []
    const unowned: ConnectivityService[] = []
    for (const svc of map.services) {
      if (svc.teamId) {
        owned.push(svc)
        byTeam.set(svc.teamId, [...(byTeam.get(svc.teamId) ?? []), svc])
      } else {
        unowned.push(svc)
      }
    }
    return { byTeam, owned, unowned }
  }, [map.services])

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => {
      const diff = (byTeam.get(b.id)?.length ?? 0) - (byTeam.get(a.id)?.length ?? 0)
      return diff !== 0 ? diff : a.name.localeCompare(b.name)
    }),
    [teams, byTeam],
  )

  const focused = focusedTeam ? teams.find(t => t.id === focusedTeam) ?? null : null

  return (
    <section aria-label="Service ownership" className={styles.page}>
      <h1>Service ownership</h1>
      <p className={styles.lead}>
        Ownership is machine-resolved from each repository's CODEOWNERS: a service is assigned to a
        team when its wildcard (<code>*</code>) line names exactly one product team.
        Path-rule frequency is not ownership — process squads (infra, perf, archi) and the team-dev
        catch-all are excluded. Coverage grows automatically as teams adopt CODEOWNERS wildcards;
        nothing here needs to change.
      </p>
      <CoverageBar owned={owned.length} total={map.services.length} />
      {focused ? (
        <TeamDetail team={focused} services={byTeam.get(focused.id) ?? []} map={map} onBack={() => onFocusTeam(null)} onSelectService={onSelectService} onOpenArea={onOpenArea} />
      ) : (
        <>
          <ul className={styles.teams}>
            {sortedTeams.map(team => (
              <li key={team.id}><TeamCard team={team} services={byTeam.get(team.id) ?? []} onClick={() => onFocusTeam(team.id)} /></li>
            ))}
          </ul>
          <UnownedSection services={unowned} onSelectService={onSelectService} />
        </>
      )}
    </section>
  )
}

function CoverageBar({ owned, total }: { owned: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((owned / total) * 100)
  return (
    <div className={styles.coverage}>
      <div className={styles.coverageHead}>
        <span>CODEOWNERS coverage</span>
        <span><b>{owned}</b> of {total} services have a resolved owner ({pct}%)</span>
      </div>
      <div className={styles.track}><div className={styles.fill} style={{ width: `${Math.max(pct, 1)}%` }} /></div>
    </div>
  )
}

function TeamCard({ team, services, onClick }: { team: Team; services: ConnectivityService[]; onClick: () => void }) {
  const hasServices = services.length > 0
  return (
    <button type="button" className={styles.card} data-empty={hasServices ? 'false' : 'true'} onClick={onClick}>
      <span className={styles.cardHead}>
        <b>{team.name}</b>
        <span className={styles.badge}>{services.length}</span>
      </span>
      <span className={styles.mono}>{(team.githubTeams ?? []).join(', ')}</span>
      {hasServices
        ? <span className={styles.cardServices}>{services.map(svc => <span key={svc.name}>{svc.name}</span>)}</span>
        : <span className={styles.empty}>No CODEOWNERS ownership resolved yet</span>}
    </button>
  )
}

function OwnedAreas({ map, teamId, onOpenArea }: { map: ConnectivityMap; teamId: string; onOpenArea: (id: string) => void }) {
  const owned = (map.areas ?? []).filter(a => (a.owners ?? []).includes(teamId))
  return (
    <section aria-label="Owned areas" className={styles.areas}>
      <span className={styles.muted}>Areas:</span>
      {owned.length ? owned.map(a => <AreaChip key={a.id} area={a} onClick={() => onOpenArea(a.id)} />) : <span className={styles.muted}>none assigned yet</span>}
    </section>
  )
}

function TeamDetail({ team, services, map, onBack, onSelectService, onOpenArea }: {
  team: Team
  services: ConnectivityService[]
  map: ConnectivityMap
  onBack: () => void
  onSelectService: (name: string) => void
  onOpenArea: (id: string) => void
}) {
  return (
    <div className={styles.detail}>
      <button type="button" className={styles.back} onClick={onBack}>← All teams</button>
      <div className={styles.detailHead}>
        <h2>{team.name}</h2>
        <span className={styles.mono}>{(team.githubTeams ?? []).join(', ')}</span>
        {team.slackChannel && <span className={styles.muted}>{team.slackChannel}</span>}
        {team.onCallUrl && <a href={team.onCallUrl} target="_blank" rel="noreferrer">on-call ↗</a>}
      </div>
      <OwnedAreas map={map} teamId={team.id} onOpenArea={onOpenArea} />
      {services.length === 0 ? (
        <p className={styles.muted}>
          No service resolves to this team from CODEOWNERS. A repository's wildcard line naming{' '}
          <code>{(team.githubTeams ?? [])[0] ?? team.id}</code> as its only product team will appear here on the next discovery run.
        </p>
      ) : (
        <ul className={styles.services}>
          {services.map(svc => {
            const lane = getServiceLane(svc.name, map.areas ?? [])
            return (
              <li key={svc.name} className={styles.service}>
                <div className={styles.serviceHead}>
                  <b>{svc.name}</b>
                  <span className={styles.type}>{svc.type}</span>
                  {lane && <AreaChip area={lane} />}
                  {svc.provenance?.source === 'discovered' && <span className={styles.scanned} title={svc.provenance.evidence}>✓ scanned {svc.provenance.lastVerified}</span>}
                  <span className={styles.stats}>
                    <span><b>{map.connections.filter(c => c.from === svc.name).length}</b> calls</span>
                    <span><b>{map.connections.filter(c => c.to === svc.name).length}</b> called by</span>
                    <span><b>{svc.endpoints.length}</b> endpoints</span>
                  </span>
                </div>
                <p className={styles.muted}>{svc.description}</p>
                {(svc.githubTeams ?? []).length > 0 && (
                  <div className={styles.wildcard}>
                    <span className={styles.muted}>CODEOWNERS wildcard:</span>
                    {(svc.githubTeams ?? []).map(gt => {
                      const isOwner = (team.githubTeams ?? []).includes(gt)
                      return (
                        <span key={gt} className={styles.gt} data-owner={isOwner ? 'true' : 'false'} title={isOwner ? 'Resolved owner (only product team on the wildcard line)' : 'Process squad / functional team — excluded from ownership'}>{gt}</span>
                      )
                    })}
                  </div>
                )}
                <div className={styles.actions}>
                  <button type="button" onClick={() => onSelectService(svc.name)}>Open in graph</button>
                  {svc.repoUrl && <a href={svc.repoUrl} target="_blank" rel="noreferrer">repo ↗</a>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function UnownedSection({ services, onSelectService }: { services: ConnectivityService[]; onSelectService: (name: string) => void }) {
  if (services.length === 0) {
    return null
  }
  return (
    <section aria-label="Services without a resolved owner" className={styles.unowned}>
      <h2>Services without a resolved owner ({services.length})</h2>
      <p className={styles.muted}>
        Their CODEOWNERS wildcard names zero product teams, several, or only process squads. Adding a
        single product team to the repository's <code>*</code> line claims the service here on the next discovery run.
      </p>
      <div className={styles.pills}>
        {[...services].sort((a, b) => a.name.localeCompare(b.name)).map(svc => (
          <button key={svc.name} type="button" title={svc.description} onClick={() => onSelectService(svc.name)}>{svc.name}</button>
        ))}
      </div>
    </section>
  )
}
