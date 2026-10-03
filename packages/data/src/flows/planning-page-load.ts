import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

const planning_page_load: ServiceFlow = ServiceFlowSchema.parse({
  "id": "planning-page-load",
  "name": "Planning Page Load",
  "description": "A manager opens the planning page. Phased loading: the initial paint fetches the planning context and week shifts from the monolith (shift reads can hit the read replica behind REPLICA_SHIFTS_CONTROLLER_ENABLED), then the compliance panels fetch alerts and weekly rests (labour-law rules are evaluated in-process from synced rule data), and the workload forecast loads from svc-workload-plan. svc-bff-planning has been decommissioned and is no longer in this flow; a previously documented frontend→svc-search call was removed (no evidence: svc-search exposes no HTTP API).",
  "trigger": {"actor": "manager"},
  "primaryArea": "planning",
  "chapters": [
    { "title": "A manager opens the planning page", "summary": "The planning store starts a phased load: the planning context and the week's shifts come from skello-app first.", "refs": ["skello-app-front", "cu-ppl-store"] },
    { "title": "The week's shifts are read", "summary": "skello-app reads shifts, employees and contracts, from the read replica when the replica flag is on.", "refs": ["skello-app", "cu-ppl-index", "pg-skello-planning"] },
    { "title": "Compliance panels fill in", "summary": "The browser computes labour-law alerts from the loaded shifts; skello-app computes weekly rests with rules from svc-labour-laws.", "refs": ["cu-ppl-alerts-lib", "cu-ppl-weekly-rests", "svc-labour-laws", "dynamo-labour-laws-planning"] },
    { "title": "The workload forecast loads", "summary": "The planning store fetches the week's forecast from svc-workload-plan, which keeps it in MongoDB.", "refs": ["svc-workload-plan", "mongo-workload-planning"] }
  ],
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "GET /v3/api/plannings/shifts — fetch planning context (shifts + employees + contracts for shop + week)",
      "phase": "initial paint"
    },
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "Load week shifts — V3::Api::Plannings::ShiftsController#index (replica reads behind REPLICA_SHIFTS_CONTROLLER_ENABLED)",
      "phase": "initial paint"
    },
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "Compliance panels — ShiftsController#weekly_rests; the labour-law alerts themselves are computed IN THE BROWSER (ShiftsAlertsService, @skelloapp/skello-shifts-alerts)",
      "phase": "compliance panels"
    },
    {
      "from": "skello-app",
      "to": "svc-labour-laws",
      "action": "GET /labour-laws — read applicable labour law rules for the shop",
      "phase": "compliance panels"
    },
    {
      "from": "skello-app-front",
      "to": "svc-workload-plan",
      "action": "GET /v2/workload-plans — fetch workload forecast for the week",
      "phase": "forecast"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-ppl-store",
      "service": "skello-app-front",
      "kind": "service",
      "label": "plannings/shifts store",
      "path": "apps/vue-app/src/shared/store/modules/plannings/shifts.js",
      "description": "Orchestrates the phased load: fetchShifts (chunked), fetchShiftAlerts (history reads for rolling-week alerts), weekly options, counters"
    },
    {
      "id": "cu-ppl-alerts-lib",
      "service": "skello-app-front",
      "kind": "service",
      "label": "ShiftsAlertsService (@skelloapp/skello-shifts-alerts)",
      "description": "Labour-law compliance alerts computed IN THE BROWSER from the loaded shifts + active alert list — no per-alert server call"
    },
    {
      "id": "cu-ppl-index",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::Plannings::ShiftsController#index",
      "path": "app/controllers/v3/api/plannings/shifts_controller.rb",
      "description": "Week-shift reads, routed to the read replica when REPLICA_SHIFTS_CONTROLLER_ENABLED (distribute_reads)"
    },
    {
      "id": "cu-ppl-weekly-rests",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::Shifts::WeeklyRests::WeeklyRestsService",
      "path": "app/services/v3/shifts/weekly_rests/weekly_rests_service.rb",
      "description": "Weekly-rest compliance computation (PTO absence keys excluded) behind ShiftsController#weekly_rests"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-ppl-store",
      "label": "open planning page",
      "mode": "sync"
    },
    {
      "from": "cu-ppl-store",
      "to": "cu-ppl-index",
      "label": "GET shifts (chunked fetch)",
      "mode": "sync"
    },
    {
      "from": "cu-ppl-index",
      "to": "pg-skello-planning",
      "label": "shift reads",
      "mode": "sync",
      "condition": "read replica when REPLICA_SHIFTS_CONTROLLER_ENABLED",
      "crud": ["read"]
    },
    {
      "from": "cu-ppl-store",
      "to": "cu-ppl-alerts-lib",
      "label": "compute compliance alerts in-browser",
      "mode": "sync"
    },
    {
      "from": "cu-ppl-store",
      "to": "skello-app",
      "label": "GET weekly_rests",
      "mode": "sync"
    },
    {
      "from": "skello-app",
      "to": "cu-ppl-weekly-rests",
      "label": "ShiftsController#weekly_rests → WeeklyRestsService",
      "mode": "sync"
    },
    {
      "from": "cu-ppl-store",
      "to": "svc-workload-plan",
      "label": "GET /v2/workload-plans (forecast phase)",
      "mode": "sync"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-planning",
      "type": "postgresql",
      "label": "skello_production",
      "resources": ["pg:skello_production"],
      "description": "Shifts, employees, contracts and planning data — primary monolith DB (shift index reads can be routed to the read replica)"
    },
    {
      "id": "dynamo-labour-laws-planning",
      "type": "dynamodb",
      "label": "svcLabourLaws-{env}",
      "resources": ["ddb:svcLabourLaws"],
      "description": "Labour law rule sets for compliance display"
    },
    {
      "id": "mongo-workload-planning",
      "type": "mongodb",
      "label": "svc-workload-plan (MongoDB)",
      "resources": ["mongo:svc-workload-plan"],
      "description": "Workload plan forecasts and staffing rules (corrected 2026-06-12: the previously documented DynamoDB store was migrated — the container binds the Mongo repository)"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-skello-planning",
      "label": "read planning data",
      "crud": ["read"]
    },
    {
      "from": "svc-labour-laws",
      "to": "dynamo-labour-laws-planning",
      "label": "read rules",
      "crud": ["read"]
    },
    {
      "from": "svc-workload-plan",
      "to": "mongo-workload-planning",
      "label": "read forecast",
      "crud": ["read"]
    }
  ]
})

export default planning_page_load
