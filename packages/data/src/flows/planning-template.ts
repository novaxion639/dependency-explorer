import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

const planning_template: ServiceFlow = ServiceFlowSchema.parse({
  "id": "planning-template",
  "name": "Planning Template — Save & Apply",
  "description": "A manager saves the current week's planning as a reusable template, or applies an existing template to populate a new week. Applying a template evaluates labour-law compliance in-process (rules previously synced from svc-labour-laws — no per-operation HTTP call) and updates metrics identically to a batch shift creation. (Corrected 2026-06-12: the previously documented svc-shifts metrics call had no code path — no svc-shifts client exists anywhere in the monolith.)",
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
