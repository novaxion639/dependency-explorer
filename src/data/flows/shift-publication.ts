import { ServiceFlowSchema } from '../schemas'
import type { ServiceFlow } from '../schemas'

const shift_publication: ServiceFlow = ServiceFlowSchema.parse({
  "id": "shift-publication",
  "name": "Shift Publication",
  "description": "A planner publishes the week’s planning. The monolith marks all draft shifts as published and bulk-enqueues employee notifications via SQS, with the event bus recording a planning.published audit event.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST /v3/shifts/publish — publish all draft shifts for the week"
    },
    {
      "from": "skello-app",
      "to": "svc-events",
      "action": "POST /events — emit planning.published event"
    },
    {
      "from": "svc-events",
      "to": "svc-communications-v2",
      "action": "SQS email-high — bulk notify employees of published planning"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-shifts-pub",
      "type": "postgresql",
      "label": "skello_production",
      "description": "Bulk-updates shift rows to published state"
    },
    {
      "id": "sqs-shift-events-pub",
      "type": "sqs",
      "label": "skello-sqs-events",
      "description": "Async event queue — one message per employee to notify"
    },
    {
      "id": "dynamo-events-pub",
      "type": "dynamodb",
      "label": "svcEvents-{env}",
      "description": "Audit event store for planning.published"
    },
    {
      "id": "lambda-notify-pub",
      "type": "lambda",
      "label": "shift-notify-dispatch",
      "description": "Dispatches bulk published-planning notification emails"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-skello-shifts-pub",
      "label": "bulk publish",
      "crud": ["update"]
    },
    {
      "from": "skello-app",
      "to": "sqs-shift-events-pub",
      "label": "bulk enqueue"
    },
    {
      "from": "svc-events",
      "to": "dynamo-events-pub",
      "label": "write",
      "crud": ["create"]
    },
    {
      "from": "svc-communications-v2",
      "to": "lambda-notify-pub",
      "label": "invoke"
    }
  ]
})

export default shift_publication
