import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Code layer traced 2026-07-11 — the simplest planning surface: plain Event
// CRUD in one controller (Event.create!/update/destroy), plus the read side
// (index merges events with holidays and birthdays for the planning grid).
const planning_event_management: ServiceFlow = ServiceFlowSchema.parse({
  "id": "planning-event-management",
  "name": "Planning Event Management",
  "description": "A manager creates, edits or deletes a planning event (notes, closures, milestones) shown on the planning grid. Plain monolith CRUD: V3::Api::Plannings::EventsController writes Event rows directly (no service object), and its index action assembles the grid overlay — events for the period plus holidays (V3::HolidaySettings::QueryService) and employee birthdays. No notifications, no cross-service hop.",
  "trigger": {"actor": "manager"},
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST / PATCH / DELETE /v3/api/plannings/events — manage grid events; GET index merges events + holidays + birthdays"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-evt-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::Plannings::EventsController",
      "path": "app/controllers/v3/api/plannings/events_controller.rb",
      "description": "CRUD directly on the Event model (create!/update/destroy) + #index/#holidays/#birthdays read surface for the grid overlay"
    },
    {
      "id": "cu-evt-holidays",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::HolidaySettings::QueryService",
      "path": "app/services/v3/holiday_settings/query_service.rb",
      "description": "Resolves the shop's holiday configuration for the requested period"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-evt-controller",
      "label": "manage planning events",
      "mode": "sync"
    },
    {
      "from": "cu-evt-controller",
      "to": "pg-planning-events",
      "label": "Event.create! / update / destroy / period reads",
      "mode": "sync",
      "crud": ["create", "read", "update", "delete"]
    },
    {
      "from": "cu-evt-controller",
      "to": "cu-evt-holidays",
      "label": "V3::HolidaySettings::QueryService",
      "mode": "sync",
      "condition": "grid overlay read (#holidays)"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-planning-events",
      "type": "postgresql",
      "label": "skello_production — events",
      "description": "Planning grid events scoped by shop and date range"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-planning-events",
      "label": "grid events",
      "crud": ["create", "read", "update", "delete"]
    }
  ]
})

export default planning_event_management
