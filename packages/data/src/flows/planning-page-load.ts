import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

const planning_page_load: ServiceFlow = ServiceFlowSchema.parse({
  "id": "planning-page-load",
  "name": "Planning Page Load",
  "description": "A manager opens the planning page. The frontend calls the Rails monolith for the planning context (shifts, employees, labour laws) and fetches workload plan data from svc-workload-plan. svc-bff-planning has been decommissioned and is no longer in this flow; a previously documented frontend→svc-search call was removed (no evidence: svc-search exposes no HTTP API and the frontend has no search service URL).",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "GET /v3/plannings — fetch planning context (shifts + employees + contracts for shop + week)"
    },
    {
      "from": "skello-app-front",
      "to": "svc-workload-plan",
      "action": "GET /v2/workload-plans — fetch workload forecast for the week"
    },
    {
      "from": "skello-app",
      "to": "svc-labour-laws",
      "action": "GET /labour-laws — retrieve applicable labour law rules for the shop"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-planning",
      "type": "postgresql",
      "label": "skello_production",
      "description": "Shifts, employees, contracts and planning data — primary monolith DB"
    },
    {
      "id": "dynamo-labour-laws-planning",
      "type": "dynamodb",
      "label": "svcLabourLaws-{env}",
      "description": "Labour law rule sets for compliance display"
    },
    {
      "id": "dynamo-workload-planning",
      "type": "dynamodb",
      "label": "svcWorkloadPlan-{env}",
      "description": "Workload plan forecasts and staffing rules"
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
      "to": "dynamo-workload-planning",
      "label": "read forecast",
      "crud": ["read"]
    }
  ]
})

export default planning_page_load
