import { ServiceFlowSchema } from '../schemas'
import type { ServiceFlow } from '../schemas'

const shift_creation: ServiceFlow = ServiceFlowSchema.parse({
  "id": "shift-creation",
  "name": "Shift Creation",
  "description": "A planner creates a shift on the planning page. The monolith validates it against labour laws, persists it, pushes metrics to svc-shifts, and emits an async event so the employee gets notified.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-bff-planning",
      "action": "GET /planning — load planning context (employees, shops)"
    },
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST /v3/shifts — create new shift"
    },
    {
      "from": "skello-app",
      "to": "svc-labour-laws",
      "action": "POST /validate — check labour law compliance"
    },
    {
      "from": "skello-app",
      "to": "svc-shifts",
      "action": "POST /shift-metrics/employee — update shift metrics"
    },
    {
      "from": "skello-app",
      "to": "svc-events",
      "action": "POST /events — emit shift.created event"
    },
    {
      "from": "svc-events",
      "to": "svc-communications-v2",
      "action": "SQS email-high — notify employee of new shift"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-shifts",
      "type": "postgresql",
      "label": "skello_production",
      "description": "Persists shifts in the monolith"
    },
    {
      "id": "dynamo-labour-laws",
      "type": "dynamodb",
      "label": "svcLabourLaws-{env}",
      "description": "Labour law rule sets and shop compliance configs"
    },
    {
      "id": "mongo-shifts",
      "type": "mongodb",
      "label": "svc-shifts",
      "description": "Aggregated shift metrics store"
    },
    {
      "id": "sqs-shift-events",
      "type": "sqs",
      "label": "skello-sqs-events",
      "description": "Async event queue for shift lifecycle events"
    },
    {
      "id": "dynamo-events-shift",
      "type": "dynamodb",
      "label": "svcEvents-{env}",
      "description": "Audit event store for shift.created"
    },
    {
      "id": "lambda-notify-shift",
      "type": "lambda",
      "label": "shift-notify-dispatch",
      "description": "Dispatches employee shift notification emails"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-skello-shifts",
      "label": "write shift"
    },
    {
      "from": "svc-labour-laws",
      "to": "dynamo-labour-laws",
      "label": "read rules"
    },
    {
      "from": "svc-shifts",
      "to": "mongo-shifts",
      "label": "write metrics"
    },
    {
      "from": "skello-app",
      "to": "sqs-shift-events",
      "label": "enqueue"
    },
    {
      "from": "svc-events",
      "to": "dynamo-events-shift",
      "label": "write"
    },
    {
      "from": "svc-communications-v2",
      "to": "lambda-notify-shift",
      "label": "invoke"
    }
  ]
})

export default shift_creation
