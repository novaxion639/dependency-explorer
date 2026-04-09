import { ServiceFlowSchema } from '../schemas'
import type { ServiceFlow } from '../schemas'

const planning_page_load: ServiceFlow = ServiceFlowSchema.parse({
  "id": "planning-page-load",
  "name": "Planning Page Load",
  "description": "A manager opens the planning page. svc-bff-planning fans out 6 parallel requests — shifts, employees, labour laws, workload plan, scheduling suggestions and employee search — then assembles the full planning view before responding.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-bff-planning",
      "action": "GET /planning — request assembled planning page (shopId + week range)"
    },
    {
      "from": "svc-bff-planning",
      "to": "svc-shifts",
      "action": "POST /shift-details — fetch all shifts for the selected week [parallel]"
    },
    {
      "from": "svc-bff-planning",
      "to": "svc-employees",
      "action": "GET /employees — fetch full team roster with contracts [parallel]"
    },
    {
      "from": "svc-bff-planning",
      "to": "svc-labour-laws",
      "action": "GET /labour-laws — retrieve labour law rules for the shop [parallel]"
    },
    {
      "from": "svc-bff-planning",
      "to": "svc-workload-plan",
      "action": "GET /v2/workload-plans — fetch workload forecast for the week [parallel]"
    },
    {
      "from": "svc-bff-planning",
      "to": "svc-automatic-scheduling",
      "action": "GET /auto_scheduling/compute — fetch auto-scheduling hints [parallel]"
    },
    {
      "from": "svc-bff-planning",
      "to": "svc-search",
      "action": "GET /employees/search — search available staff for open slots [parallel]"
    }
  ],
  "infraNodes": [
    {
      "id": "mongo-bff-planning-cache",
      "type": "mongodb",
      "label": "svc-bff-planning",
      "description": "Planning BFF response cache and auto-scheduling request state"
    },
    {
      "id": "mongo-shifts-planning",
      "type": "mongodb",
      "label": "svc-shifts",
      "description": "Aggregated shift metrics and shift detail store"
    },
    {
      "id": "pg-employees-planning",
      "type": "postgresql",
      "label": "svcEmployees-{env}",
      "description": "Employee contracts, absences and counters"
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
      "description": "Workload plan forecasts and rules"
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
      "from": "svc-bff-planning",
      "to": "mongo-bff-planning-cache",
      "label": "read/write cache"
    },
    {
      "from": "svc-shifts",
      "to": "mongo-shifts-planning",
      "label": "read shifts"
    },
    {
      "from": "svc-employees",
      "to": "pg-employees-planning",
      "label": "read roster"
    },
    {
      "from": "svc-labour-laws",
      "to": "dynamo-labour-laws-planning",
      "label": "read rules"
    },
    {
      "from": "svc-workload-plan",
      "to": "dynamo-workload-planning",
      "label": "read forecast"
    },
    {
      "from": "svc-search",
      "to": "es-search-planning",
      "label": "query index"
    }
  ]
})

export default planning_page_load
