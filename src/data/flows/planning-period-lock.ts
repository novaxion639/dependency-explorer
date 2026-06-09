import { ServiceFlowSchema } from '../schemas'
import type { ServiceFlow } from '../schemas'

const planning_period_lock: ServiceFlow = ServiceFlowSchema.parse({
  "id": "planning-period-lock",
  "name": "Planning Period Lock / Unlock",
  "description": "A manager locks or unlocks a planning period (day, week or month). The monolith writes the new validation state and optionally prevents further edits until unlocked. An intermediate-locked period can also trigger an unlock request to a higher authority.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST /v3/api/weekly_options/validate_period — submit lock or unlock with validation_level and shop_id"
    },
    {
      "from": "skello-app",
      "to": "skello-app",
      "action": "Validate manager permissions and current period state"
    },
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST /v3/api/weekly_options/unlock_request — (intermediate lock only) request unlock from higher authority"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-lock-period",
      "type": "postgresql",
      "label": "skello_production",
      "description": "Stores weekly_options lock state per shop and period"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-lock-period",
      "label": "write lock state",
      "crud": ["update"]
    }
  ]
})

export default planning_period_lock
