import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

const planning_event_management: ServiceFlow = ServiceFlowSchema.parse({
  "id": "planning-event-management",
  "name": "Planning Event Management",
  "description": "A manager creates, edits or deletes a planning event (notes, closures, milestones) visible on the planning grid. Events are stored in the monolith and do not trigger notifications — they are purely informational overlays on the planning view.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST /v3/api/plannings/events — create new planning event with title, date range and shop_id"
    },
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "PATCH /v3/api/plannings/events/{id} — edit event title, dates or description"
    },
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "DELETE /v3/api/plannings/events/{id} — delete the event from the planning grid"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-planning-events",
      "type": "postgresql",
      "label": "skello_production",
      "description": "Stores planning events — informational overlays on the planning grid"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-planning-events",
      "label": "create / update / delete",
      "crud": ["create", "update", "delete"]
    }
  ]
})

export default planning_event_management
