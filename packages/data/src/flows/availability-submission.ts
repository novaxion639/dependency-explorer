import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Flow inventory follow-up (requests domain, employee-initiated). Traced
// 2026-06-15: api/v2/availabilities/* (employee/mobile surface) +
// v3/api/availabilities_controller (manager surface) → v3/availabilities/
// create_service.rb. Entirely monolith-internal — availabilities never leave
// PostgreSQL; their effect is display/constraint data on the planning.
const availability_submission: ServiceFlow = ServiceFlowSchema.parse({
  "id": "availability-submission",
  "name": "Availability Submission & Review",
  "description": "An employee declares availability/unavailability slots (one-off on a date, or weekly recurring) from the employee surface (api/v2 — also used by the mobile app, which is outside the map). Submissions land as pending; the manager reviews them in the pending list and manages availabilities from the planning side (v3 API). Fully monolith-internal: rows in PostgreSQL consumed by planning display and shift-assignment tooling — no cross-service hop.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "Submit availability (api/v2/availabilities — one-off or weekly recurrence); manager review via pending list + v3 API"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-avs-employee-api",
      "service": "skello-app",
      "kind": "controller",
      "label": "Api::V2::Availabilities::AvailabilitiesController#create",
      "path": "app/controllers/api/v2/availabilities/availabilities_controller.rb",
      "description": "Employee submission surface (web + mobile): parses date/hours into starts_at/ends_at, day_of_week and recurrence ('weekly' or 'none'), guards on active-at-date and shop membership"
    },
    {
      "id": "cu-avs-pending",
      "service": "skello-app",
      "kind": "controller",
      "label": "Api::V2::Availabilities::PendingAvailabilitiesController",
      "path": "app/controllers/api/v2/availabilities/pending_availabilities_controller.rb",
      "description": "Manager review list of pending availability requests (can_create_self_availabilities gate)"
    },
    {
      "id": "cu-avs-v3-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::AvailabilitiesController",
      "path": "app/controllers/v3/api/availabilities_controller.rb",
      "description": "Manager-side surface used from the planning (index filtered by employees, create via CreateService)"
    },
    {
      "id": "cu-avs-create-service",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::Availabilities::CreateService",
      "path": "app/services/v3/availabilities/create_service.rb",
      "description": "Availability.create with normalized slot attributes"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-avs-employee-api",
      "label": "employee submits slot",
      "mode": "sync"
    },
    {
      "from": "cu-avs-employee-api",
      "to": "pg-skello-availabilities",
      "label": "availability row (pending)",
      "mode": "sync",
      "crud": ["create"]
    },
    {
      "from": "skello-app-front",
      "to": "cu-avs-pending",
      "label": "manager pending review",
      "mode": "sync"
    },
    {
      "from": "cu-avs-pending",
      "to": "pg-skello-availabilities",
      "label": "pending list",
      "mode": "sync",
      "crud": ["read"]
    },
    {
      "from": "skello-app-front",
      "to": "cu-avs-v3-controller",
      "label": "planning-side availabilities",
      "mode": "sync"
    },
    {
      "from": "cu-avs-v3-controller",
      "to": "cu-avs-create-service",
      "label": "manager creates slot",
      "mode": "sync"
    },
    {
      "from": "cu-avs-create-service",
      "to": "pg-skello-availabilities",
      "label": "Availability.create",
      "mode": "sync",
      "crud": ["create"]
    }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-availabilities",
      "type": "postgresql",
      "label": "skello_production — availabilities",
      "description": "One-off and weekly-recurring availability slots, statused for the pending/review cycle"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-skello-availabilities",
      "label": "availability slots",
      "crud": ["create", "read", "update"]
    }
  ]
})

export default availability_submission
