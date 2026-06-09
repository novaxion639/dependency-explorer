import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

const planning_template: ServiceFlow = ServiceFlowSchema.parse({
  "id": "planning-template",
  "name": "Planning Template — Save & Apply",
  "description": "A manager saves the current week's planning as a reusable template, or applies an existing template to populate a new week. Applying a template triggers labour law validation and metric updates identical to a batch shift creation.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST /v3/api/templates — save current week's shifts as a named template"
    },
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST /v3/api/plannings/from_template — apply selected template to target week"
    },
    {
      "from": "skello-app",
      "to": "svc-labour-laws",
      "action": "POST /validate-batch — validate all template shifts against current labour law rules"
    },
    {
      "from": "skello-app",
      "to": "svc-shifts",
      "action": "POST /shift-metrics/shop-and-orga — update shop and org metrics with newly created shifts"
    },
    {
      "from": "skello-app",
      "to": "svc-events",
      "action": "POST /events — emit shifts.created-from-template event"
    },
    {
      "from": "svc-events",
      "to": "svc-communications-v2",
      "action": "SQS email-normal — notify employees of their shifts for the applied week"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-templates",
      "type": "postgresql",
      "label": "skello_production",
      "description": "Stores named planning templates as serialised shift definitions"
    },
    {
      "id": "pg-template-shifts",
      "type": "postgresql",
      "label": "skello_production",
      "description": "Bulk-inserts shifts generated from the applied template"
    },
    {
      "id": "dynamo-labour-laws-template",
      "type": "dynamodb",
      "label": "svcLabourLaws-{env}",
      "description": "Labour law rule sets — validate each generated shift"
    },
    {
      "id": "mongo-shifts-template",
      "type": "mongodb",
      "label": "svc-shifts",
      "description": "Shop and org metrics updated after template application"
    },
    {
      "id": "sqs-template",
      "type": "sqs",
      "label": "skello-sqs-events",
      "description": "Async event queue for template-generated shift notifications"
    },
    {
      "id": "dynamo-events-template",
      "type": "dynamodb",
      "label": "svcEvents-{env}",
      "description": "Audit event store for shifts.created-from-template"
    },
    {
      "id": "lambda-notify-template",
      "type": "lambda",
      "label": "shift-notify-dispatch",
      "description": "Dispatches shift notifications to all employees in the applied template"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-templates",
      "label": "write template",
      "crud": ["create"]
    },
    {
      "from": "skello-app",
      "to": "pg-template-shifts",
      "label": "bulk insert shifts",
      "crud": ["create"]
    },
    {
      "from": "svc-labour-laws",
      "to": "dynamo-labour-laws-template",
      "label": "read rules",
      "crud": ["read"]
    },
    {
      "from": "svc-shifts",
      "to": "mongo-shifts-template",
      "label": "write metrics",
      "crud": ["create"]
    },
    {
      "from": "skello-app",
      "to": "sqs-template",
      "label": "enqueue"
    },
    {
      "from": "svc-events",
      "to": "dynamo-events-template",
      "label": "write",
      "crud": ["create"]
    },
    {
      "from": "svc-communications-v2",
      "to": "lambda-notify-template",
      "label": "invoke"
    }
  ]
})

export default planning_template
