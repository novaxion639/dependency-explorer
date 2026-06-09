import { ServiceFlowSchema } from '../schemas'
import type { ServiceFlow } from '../schemas'

const planning_page_load: ServiceFlow = ServiceFlowSchema.parse({
  "id": "planning-page-load",
  "name": "Planning Page Load",
  "description": "A manager opens the planning page. The frontend calls the Rails monolith for the planning context (shifts, employees, labour laws), and fetches workload plan data and employee search from dedicated microservices. svc-bff-planning has been decommissioned from sandbox and is no longer in this flow.",
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
      "from": "skello-app-front",
      "to": "svc-search",
      "action": "GET /employees/search — search available staff for open slots"
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
    },
    {
      "id": "es-search-planning",
      "type": "elasticsearch",
      "label": "svc-search",
      "description": "Employee availability and shift search index"
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
    },
    {
      "from": "svc-search",
      "to": "es-search-planning",
      "label": "query index",
      "crud": ["read"]
    }
  ]
})

export default planning_page_load
