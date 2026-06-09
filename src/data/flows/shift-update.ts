import { ServiceFlowSchema } from '../schemas'
import type { ServiceFlow } from '../schemas'

const shift_update: ServiceFlow = ServiceFlowSchema.parse({
  "id": "shift-update",
  "name": "Shift Update",
  "description": "A planner edits an existing shift. The monolith validates the change against labour laws, persists it, recalculates metrics in svc-shifts, and emits an async event so the employee gets notified of the change.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "PATCH /v3/shifts/:id — update shift"
    },
    {
      "from": "skello-app",
      "to": "svc-labour-laws",
      "action": "POST /validate — check updated shift is labour-law compliant"
    },
    {
      "from": "skello-app",
      "to": "svc-shifts",
      "action": "PATCH /shift-metrics/employee/:id — recalculate shift metrics"
    },
    {
      "from": "skello-app",
      "to": "svc-events",
      "action": "POST /events — emit shift.updated event"
    },
    {
      "from": "svc-events",
      "to": "svc-communications-v2",
      "action": "SQS email-high — notify employee of updated shift"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-shifts-upd",
      "type": "postgresql",
      "label": "skello_production",
      "description": "Updates the shift row in the monolith"
    },
    {
      "id": "dynamo-labour-laws-upd",
      "type": "dynamodb",
      "label": "svcLabourLaws-{env}",
      "description": "Labour law rule sets checked before update"
    },
    {
      "id": "mongo-shifts-upd",
      "type": "mongodb",
      "label": "svc-shifts",
      "description": "Aggregated shift metrics store — recalculated after update"
    },
    {
      "id": "sqs-shift-events-upd",
      "type": "sqs",
      "label": "skello-sqs-events",
      "description": "Async event queue for shift lifecycle events"
    },
    {
      "id": "dynamo-events-shift-upd",
      "type": "dynamodb",
      "label": "svcEvents-{env}",
      "description": "Audit event store for shift.updated"
    },
    {
      "id": "lambda-notify-shift-upd",
      "type": "lambda",
      "label": "shift-notify-dispatch",
      "description": "Dispatches employee shift change notification emails"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-skello-shifts-upd",
      "label": "update shift",
      "crud": ["update"]
    },
    {
      "from": "svc-labour-laws",
      "to": "dynamo-labour-laws-upd",
      "label": "read rules",
      "crud": ["read"]
    },
    {
      "from": "svc-shifts",
      "to": "mongo-shifts-upd",
      "label": "recalculate metrics",
      "crud": ["update"]
    },
    {
      "from": "skello-app",
      "to": "sqs-shift-events-upd",
      "label": "enqueue"
    },
    {
      "from": "svc-events",
      "to": "dynamo-events-shift-upd",
      "label": "write",
      "crud": ["create"]
    },
    {
      "from": "svc-communications-v2",
      "to": "lambda-notify-shift-upd",
      "label": "invoke"
    }
  ]
})

export default shift_update
