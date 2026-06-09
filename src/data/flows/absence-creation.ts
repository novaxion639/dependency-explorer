import { ServiceFlowSchema } from '../schemas'
import type { ServiceFlow } from '../schemas'

const absence_creation: ServiceFlow = ServiceFlowSchema.parse({
  "id": "absence-creation",
  "name": "Absence Creation",
  "description": "A manager creates an absence (paid leave, sick day, etc.) for an employee. The monolith validates the absence against labour law rules, persists it as a shift record, pushes updated metrics to svc-shifts, and emits an event so the employee is notified.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST /v3/api/plannings — create absence shift with absence_type and duration"
    },
    {
      "from": "skello-app",
      "to": "svc-labour-laws",
      "action": "POST /validate — check absence eligibility and remaining entitlement against labour law rules"
    },
    {
      "from": "skello-app",
      "to": "svc-shifts",
      "action": "POST /shift-metrics/employee — update employee shift metrics to include absence"
    },
    {
      "from": "skello-app",
      "to": "svc-events",
      "action": "POST /events — emit absence.created event"
    },
    {
      "from": "svc-events",
      "to": "svc-communications-v2",
      "action": "SQS email-high — notify employee of the recorded absence"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-absence",
      "type": "postgresql",
      "label": "skello_production",
      "description": "Stores absence as a shift record with absence_type flag"
    },
    {
      "id": "dynamo-labour-laws-absence",
      "type": "dynamodb",
      "label": "svcLabourLaws-{env}",
      "description": "Labour law entitlements and absence eligibility rules"
    },
    {
      "id": "mongo-shifts-absence",
      "type": "mongodb",
      "label": "svc-shifts",
      "description": "Employee shift metrics updated to reflect the absence"
    },
    {
      "id": "sqs-absence",
      "type": "sqs",
      "label": "skello-sqs-events",
      "description": "Async event queue for absence lifecycle events"
    },
    {
      "id": "dynamo-events-absence",
      "type": "dynamodb",
      "label": "svcEvents-{env}",
      "description": "Audit event store for absence.created"
    },
    {
      "id": "lambda-notify-absence",
      "type": "lambda",
      "label": "shift-notify-dispatch",
      "description": "Dispatches absence confirmation notification to the employee"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-absence",
      "label": "write absence",
      "crud": ["create"]
    },
    {
      "from": "svc-labour-laws",
      "to": "dynamo-labour-laws-absence",
      "label": "read entitlements",
      "crud": ["read"]
    },
    {
      "from": "svc-shifts",
      "to": "mongo-shifts-absence",
      "label": "write metrics",
      "crud": ["update"]
    },
    {
      "from": "skello-app",
      "to": "sqs-absence",
      "label": "enqueue"
    },
    {
      "from": "svc-events",
      "to": "dynamo-events-absence",
      "label": "write",
      "crud": ["create"]
    },
    {
      "from": "svc-communications-v2",
      "to": "lambda-notify-absence",
      "label": "invoke"
    }
  ]
})

export default absence_creation
