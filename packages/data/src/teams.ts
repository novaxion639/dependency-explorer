import { TeamSchema } from '@dependency-explorer/schema'
import type { Team } from '@dependency-explorer/schema'
import { z } from 'zod'

// githubTeams: CODEOWNERS slugs that map to each squad. Discovery assigns
// service ownership ONLY through these mappings — never by guessing.
// The 2026-06-09 scan shows the real org slugs (team-salsa, team-pesto,
// team-roquefort, squad-data, squad-front, squad-perf, squad-infra, team-dev)
// do not match this squad list: the list below predates discovery and needs
// to be reconciled with the real org before any mapping is added. Until then
// no teamId gets assigned and the drift report lists every unmapped slug.
// (squad-infra/squad-perf/team-dev appear in every repo via file-level rules —
// CODEOWNERS frequency is NOT service ownership.)
const teams: Team[] = z.array(TeamSchema).parse([
  {
    id: 'squad-planning',
    name: 'Squad Planning',
    slackChannel: '#squad-planning',
    githubTeams: ['@skelloapp/squad-planning'],
  },
  {
    id: 'squad-hr',
    name: 'Squad HR',
    slackChannel: '#squad-hr',
    githubTeams: ['@skelloapp/squad-hr'],
  },
  {
    id: 'squad-platform',
    name: 'Squad Platform',
    slackChannel: '#squad-platform',
    githubTeams: ['@skelloapp/squad-platform'],
  },
  {
    id: 'squad-billing',
    name: 'Squad Billing',
    slackChannel: '#squad-billing',
    githubTeams: ['@skelloapp/squad-billing'],
  },
  {
    id: 'squad-time-attendance',
    name: 'Squad Time & Attendance',
    slackChannel: '#squad-time-attendance',
    githubTeams: ['@skelloapp/squad-time-attendance'],
  },
  {
    id: 'squad-intelligence',
    name: 'Squad Intelligence',
    slackChannel: '#squad-intelligence',
    githubTeams: ['@skelloapp/squad-intelligence'],
  },
  {
    id: 'squad-core',
    name: 'Squad Core',
    slackChannel: '#squad-core',
    githubTeams: ['@skelloapp/squad-core'],
  },
])

export default teams
