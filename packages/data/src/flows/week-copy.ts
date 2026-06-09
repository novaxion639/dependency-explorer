import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

const week_copy: ServiceFlow = ServiceFlowSchema.parse({
  "id": "week-copy",
  "name": "Week Copy",
  "description": "A manager copies all shifts from one week to another. The monolith creates shifts in bulk, validates each against labour laws, updates shop and org planning metrics, then emits an event so affected employees are notified. Failed shift creations land in a DLQ for manual review.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST /v3/shifts/week-copy — submit bulk copy request with source and target week range"
    },
    {
      "from": "skello-app",
      "to": "svc-labour-laws",
      "action": "POST /validate-batch — validate each copied shift against labour laws"
    },
    {
      "from": "skello-app",
      "to": "svc-shifts",
      "action": "POST /shift-metrics/shop-and-orga — update shop and org-level planning metrics"
    },
    {
      "from": "skello-app",
      "to": "svc-events",
      "action": "POST /events — emit shifts.bulk-copied event"
    },
    {
      "from": "svc-events",
      "to": "svc-communications-v2",
      "action": "SQS email-normal — notify affected employees of copied shifts"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-week-copy",
      "type": "postgresql",
      "label": "skello_production",
      "description": "Bulk-inserts copied shifts in the monolith"
    },
    {
      "id": "dynamo-labour-laws-copy",
      "type": "dynamodb",
      "label": "svcLabourLaws-{env}",
      "description": "Labour law rule sets — read to validate each copied shift"
    },
    {
      "id": "mongo-shifts-copy",
      "type": "mongodb",
      "label": "svc-shifts",
      "description": "Updated shop and org planning metrics after the copy"
    },
    {
      "id": "sqs-week-copy",
      "type": "sqs",
      "label": "skello-sqs-events",
      "description": "Async event queue for bulk shift lifecycle events"
    },
    {
      "id": "sqs-week-copy-dlq",
      "type": "sqs",
      "label": "skello-sqs-events-dlq",
      "description": "Dead-letter queue capturing failed shift creations for manual review"
    },
    {
      "id": "dynamo-events-week-copy",
      "type": "dynamodb",
      "label": "svcEvents-{env}",
      "description": "Audit event store for shifts.bulk-copied"
    },
    {
      "id": "lambda-notify-copy",
      "type": "lambda",
      "label": "shift-notify-dispatch",
      "description": "Dispatches notifications to employees for each newly created shift"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-skello-week-copy",
      "label": "bulk insert",
      "crud": ["create"]
    },
    {
      "from": "svc-labour-laws",
      "to": "dynamo-labour-laws-copy",
      "label": "read rules",
      "crud": ["read"]
    },
    {
      "from": "svc-shifts",
      "to": "mongo-shifts-copy",
      "label": "write metrics",
      "crud": ["create"]
    },
    {
      "from": "skello-app",
      "to": "sqs-week-copy",
      "label": "enqueue"
    },
    {
      "from": "sqs-week-copy",
      "to": "sqs-week-copy-dlq",
      "label": "on failure"
    },
    {
      "from": "svc-events",
      "to": "dynamo-events-week-copy",
      "label": "write",
      "crud": ["create"]
    },
    {
      "from": "svc-communications-v2",
      "to": "lambda-notify-copy",
      "label": "invoke"
    }
  ]
})

export default week_copy
