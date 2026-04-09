import { ServiceFlowSchema } from '../schemas'
import type { ServiceFlow } from '../schemas'

const auto_planning_generation: ServiceFlow = ServiceFlowSchema.parse({
  "id": "auto-planning-generation",
  "name": "AI Auto-Planning Generation",
  "description": "A planner requests an AI-optimised schedule. The frontend calls the planning BFF which delegates to svc-automatic-scheduling, then the result is saved to the monolith.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-bff-planning",
      "action": "POST /auto-scheduling — request AI schedule"
    },
    {
      "from": "svc-bff-planning",
      "to": "svc-automatic-scheduling",
      "action": "POST /trigger — compute optimised shifts"
    },
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST /v3/shifts — save generated planning"
    },
    {
      "from": "skello-app",
      "to": "svc-events",
      "action": "POST /events — log planning event"
    }
  ],
  "infraNodes": [
    {
      "id": "lambda-auto-schedule",
      "type": "lambda",
      "label": "auto-schedule-compute",
      "description": "ML optimisation job"
    },
    {
      "id": "kinesis-shifts",
      "type": "kinesis",
      "label": "shifts-stream",
      "description": "Real-time shift event stream"
    },
    {
      "id": "dynamo-events-planning",
      "type": "dynamodb",
      "label": "svcEvents-{env}",
      "description": "Planning audit events"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-automatic-scheduling",
      "to": "lambda-auto-schedule",
      "label": "invoke ML job"
    },
    {
      "from": "svc-automatic-scheduling",
      "to": "kinesis-shifts",
      "label": "publish shifts"
    },
    {
      "from": "svc-events",
      "to": "dynamo-events-planning",
      "label": "write"
    }
  ]
})

export default auto_planning_generation
