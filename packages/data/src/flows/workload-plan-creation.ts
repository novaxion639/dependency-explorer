import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

const workload_plan_creation: ServiceFlow = ServiceFlowSchema.parse({
  "id": "workload-plan-creation",
  "name": "Workload Plan Creation",
  "description": "A planner creates a new workload forecast. The frontend posts directly to svc-workload-plan, which pulls revenue KPIs from svc-kpis-v2 to calibrate the staffing forecast before persisting the plan. (Corrected 2026-06-10: a previously documented svc-pos revenue call had no evidence in code — workload rules reference the revenue KPI served by svc-kpis-v2, a verified SDK connection.)",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-workload-plan",
      "action": "POST /workload-plans — create new workload plan"
    },
    {
      "from": "svc-workload-plan",
      "to": "svc-kpis-v2",
      "action": "POST /kpis — fetch revenue KPIs to calibrate the forecast"
    }
  ],
  "infraNodes": [
    {
      "id": "mongo-workload-create",
      "type": "mongodb",
      "label": "svc-workload-plan (MongoDB)",
      "description": "Persists the new workload plan and its forecast data"
    },
    {
      "id": "sqs-workload-create-dlq",
      "type": "sqs",
      "label": "svc-workload-plan-dlq",
      "description": "DLQ for failed workload plan processing jobs"
    },
    {
      "id": "mongo-kpis-workload",
      "type": "mongodb",
      "label": "SvcKpisV2 (VPC MongoDB)",
      "description": "Revenue KPI collections used to calibrate the staffing forecast (corrected 2026-06-10 per the svcKpisV2 architecture board — no PostgreSQL kpis-db exists)"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-workload-plan",
      "to": "mongo-workload-create",
      "label": "write plan",
      "crud": ["create"]
    },
    {
      "from": "svc-workload-plan",
      "to": "sqs-workload-create-dlq",
      "label": "DLQ"
    },
    {
      "from": "svc-kpis-v2",
      "to": "mongo-kpis-workload",
      "label": "read revenue KPIs",
      "crud": ["read"]
    }
  ]
})

export default workload_plan_creation
