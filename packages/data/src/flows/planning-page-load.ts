import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

const planning_page_load: ServiceFlow = ServiceFlowSchema.parse({
  "id": "planning-page-load",
  "name": "Planning Page Load",
  "description": "A manager opens the planning page. Phased loading: the initial paint fetches the planning context and week shifts from the monolith (shift reads can hit the read replica behind REPLICA_SHIFTS_CONTROLLER_ENABLED), then the compliance panels fetch alerts and weekly rests (labour-law rules are evaluated in-process from synced rule data), and the workload forecast loads from svc-workload-plan. svc-bff-planning has been decommissioned and is no longer in this flow; a previously documented frontend→svc-search call was removed (no evidence: svc-search exposes no HTTP API).",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "GET /v3/plannings — fetch planning context (shifts + employees + contracts for shop + week)",
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
      "action": "Compliance panels — ShiftsController#alerts + #weekly_rests (labour-law alerts computed in-process)",
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
  "infraNodes": [
    {
      "id": "pg-skello-planning",
      "type": "postgresql",
      "label": "skello_production",
      "description": "Shifts, employees, contracts and planning data — primary monolith DB (shift index reads can be routed to the read replica)"
    },
    {
      "id": "dynamo-labour-laws-planning",
      "type": "dynamodb",
      "label": "svcLabourLaws-{env}",
      "description": "Labour law rule sets for compliance display"
    },
    {
      "id": "mongo-workload-planning",
      "type": "mongodb",
      "label": "svc-workload-plan (MongoDB)",
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
