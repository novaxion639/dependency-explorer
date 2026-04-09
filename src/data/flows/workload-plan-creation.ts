import { ServiceFlowSchema } from '../schemas'
import type { ServiceFlow } from '../schemas'

const workload_plan_creation: ServiceFlow = ServiceFlowSchema.parse({
  "id": "workload-plan-creation",
  "name": "Workload Plan Creation",
  "description": "A planner creates a new workload forecast. The frontend posts directly to svc-workload-plan, which pulls revenue data from svc-pos to calibrate the staffing forecast before persisting the plan.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-workload-plan",
      "action": "POST /workload-plans — create new workload plan"
    },
    {
      "from": "svc-workload-plan",
      "to": "svc-pos",
      "action": "GET /revenue — fetch POS revenue data to calibrate forecast"
    }
  ],
  "infraNodes": [
    {
      "id": "dynamo-workload-create",
      "type": "dynamodb",
      "label": "svcWorkloadPlan-{env}",
      "description": "Persists the new workload plan and its forecast data"
    },
    {
      "id": "sqs-workload-create-dlq",
      "type": "sqs",
      "label": "svc-workload-plan-dlq",
      "description": "DLQ for failed workload plan processing jobs"
    },
    {
      "id": "dynamo-pos-create",
      "type": "dynamodb",
      "label": "svcPos-{env}",
      "description": "POS revenue data used to calibrate staffing forecast"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-workload-plan",
      "to": "dynamo-workload-create",
      "label": "write plan"
    },
    {
      "from": "svc-workload-plan",
      "to": "sqs-workload-create-dlq",
      "label": "DLQ"
    },
    {
      "from": "svc-pos",
      "to": "dynamo-pos-create",
      "label": "read revenue"
    }
  ]
})

export default workload_plan_creation
