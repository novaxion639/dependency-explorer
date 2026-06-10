import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

const workload_plan_consultation: ServiceFlow = ServiceFlowSchema.parse({
  "id": "workload-plan-consultation",
  "name": "Workload Plan Consultation",
  "description": "A planner opens the workload forecasting view. The frontend fetches the current workload plan and staffing rules directly from svc-workload-plan to display forecasts alongside the planning grid. (Previously routed through svc-bff-planning, which has been decommissioned.)",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-workload-plan",
      "action": "GET /workload-plans — fetch active workload plan for the shop and week"
    },
    {
      "from": "skello-app-front",
      "to": "svc-workload-plan",
      "action": "GET /v2/workload-rules/{shopId} — fetch staffing rules and thresholds"
    }
  ],
  "infraNodes": [
    {
      "id": "dynamo-workload",
      "type": "dynamodb",
      "label": "svcWorkloadPlan-{env}",
      "description": "Workload plans and forecasting data"
    },
    {
      "id": "sqs-workload-dlq",
      "type": "sqs",
      "label": "svc-workload-plan-dlq",
      "description": "DLQ for failed workload plan processing jobs"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-workload-plan",
      "to": "dynamo-workload",
      "label": "read",
      "crud": ["read"]
    },
    {
      "from": "svc-workload-plan",
      "to": "sqs-workload-dlq",
      "label": "DLQ"
    }
  ]
})

export default workload_plan_consultation
