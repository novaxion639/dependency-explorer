import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

const shift_deletion: ServiceFlow = ServiceFlowSchema.parse({
  "id": "shift-deletion",
  "name": "Shift Deletion",
  "description": "A planner deletes a shift on the planning page. The monolith evaluates labour-law compliance in-process (rules previously synced from svc-labour-laws — no per-operation HTTP call), removes the shift, recalculates metrics in svc-shifts, and emits an async event so the employee gets notified.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "DELETE /v3/shifts/:id — delete shift"
    },
    {
      "from": "skello-app",
      "to": "svc-shifts",
      "action": "POST /shift-metrics/employee — recalculate shift metrics"
    },
    {
      "from": "skello-app",
      "to": "svc-events",
      "action": "POST /events — emit shift.deleted event"
    },
    {
      "from": "svc-events",
      "to": "svc-communications-v2",
      "action": "SQS email-high — notify employee of deleted shift"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-shifts-del",
      "type": "postgresql",
      "label": "skello_production",
      "description": "Removes the shift row from the monolith"
    },
    {
      "id": "mongo-shifts-del",
      "type": "mongodb",
      "label": "svc-shifts",
      "description": "Aggregated shift metrics store — recalculated after removal"
    },
    {
      "id": "sqs-shift-events-del",
      "type": "sqs",
      "label": "skello-sqs-events",
      "description": "Async event queue for shift lifecycle events"
    },
    {
      "id": "dynamo-events-shift-del",
      "type": "dynamodb",
      "label": "svcEvents-{env}",
      "description": "Audit event store for shift.deleted"
    },
    {
      "id": "lambda-notify-shift-del",
      "type": "lambda",
      "label": "shift-notify-dispatch",
      "description": "Dispatches employee shift cancellation notification emails"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-skello-shifts-del",
      "label": "delete shift",
      "crud": ["delete"]
    },
    {
      "from": "svc-shifts",
      "to": "mongo-shifts-del",
      "label": "recalculate metrics",
      "crud": ["update"]
    },
    {
      "from": "skello-app",
      "to": "sqs-shift-events-del",
      "label": "enqueue"
    },
    {
      "from": "svc-events",
      "to": "dynamo-events-shift-del",
      "label": "write",
      "crud": ["create"]
    },
    {
      "from": "svc-communications-v2",
      "to": "lambda-notify-shift-del",
      "label": "invoke"
    }
  ]
})

export default shift_deletion
