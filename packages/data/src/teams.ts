import { TeamSchema } from '@dependency-explorer/schema'
import type { Team } from '@dependency-explorer/schema'
import { z } from 'zod'

// Source of truth: the skelloapp GitHub org team list (fetched 2026-06-10,
// https://github.com/orgs/skelloapp/teams). Only PRODUCT teams are listed
// here — the org also has process squads (squad-archi/infra/perf/qa/release/…,
// Terraform-generated PR-approval groups) and functional teams (team-dev =
// all developers, team-pm, team-support, …) which never own services and are
// deliberately excluded from ownership mapping.
//
// Discovery assigns a service's teamId ONLY when its CODEOWNERS wildcard
// (`*`) line names exactly one mapped product team — frequency of path rules
// is NOT ownership (squad-infra owns /aws/ everywhere; team-dev is the
// catch-all on almost every repo).
//
// slackChannel / onCallUrl are unknown — left unset rather than invented.
const teams: Team[] = z.array(TeamSchema).parse([
  { id: 'team-branza', name: 'Team Branza', githubTeams: ['@skelloapp/team-branza'] },
  { id: 'team-cheesebuzzer', name: 'Team CheeseBuzzer', githubTeams: ['@skelloapp/team-cheesebuzzer'] },
  { id: 'team-gouda', name: 'Team Gouda', githubTeams: ['@skelloapp/team-gouda'] },
  { id: 'team-harissa', name: 'Team Harissa', githubTeams: ['@skelloapp/team-harissa'] },
  { id: 'team-honey', name: 'Team Honey', githubTeams: ['@skelloapp/team-honey'] },
  { id: 'team-mozza', name: 'Team Mozza', githubTeams: ['@skelloapp/team-mozza'] },
  { id: 'team-pesto', name: 'Team Pesto', githubTeams: ['@skelloapp/team-pesto'] },
  { id: 'team-reaper', name: 'Team Reaper', githubTeams: ['@skelloapp/team-reaper'] },
  { id: 'team-roquefort', name: 'Team Roquefort', githubTeams: ['@skelloapp/team-roquefort'] },
  { id: 'team-salsa', name: 'Team Salsa', githubTeams: ['@skelloapp/team-salsa'] },
  { id: 'team-szechuan', name: 'Team Szechuan', githubTeams: ['@skelloapp/team-szechuan'] },
  { id: 'team-wasabi', name: 'Team Wasabi', githubTeams: ['@skelloapp/team-wasabi'] },
])

export default teams
