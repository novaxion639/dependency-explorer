import { TeamSchema } from './schemas'
import type { Team } from './schemas'
import { z } from 'zod'

const teams: Team[] = z.array(TeamSchema).parse([
  {
    id: 'squad-planning',
    name: 'Squad Planning',
    slackChannel: '#squad-planning',
  },
  {
    id: 'squad-hr',
    name: 'Squad HR',
    slackChannel: '#squad-hr',
  },
  {
    id: 'squad-platform',
    name: 'Squad Platform',
    slackChannel: '#squad-platform',
  },
  {
    id: 'squad-billing',
    name: 'Squad Billing',
    slackChannel: '#squad-billing',
  },
  {
    id: 'squad-time-attendance',
    name: 'Squad Time & Attendance',
    slackChannel: '#squad-time-attendance',
  },
  {
    id: 'squad-intelligence',
    name: 'Squad Intelligence',
    slackChannel: '#squad-intelligence',
  },
  {
    id: 'squad-core',
    name: 'Squad Core',
    slackChannel: '#squad-core',
  },
])

export default teams
