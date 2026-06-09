import { ServiceFlowSchema } from '../schemas'
import type { ServiceFlow } from '../schemas'

const shift_swap: ServiceFlow = ServiceFlowSchema.parse({
  "id": "shift-swap",
  "name": "Shift Swap Between Employees",
  "description": "A manager swaps shifts between two employees. The monolith reassigns both shifts, validates each employee's new schedule against labour law rules, and emits an event so both employees are notified of the change.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "PATCH /v3/api/plannings — swap shifts between two employees (isSwappingUserShifts flag)"
    },
    {
      "from": "skello-app",
      "to": "svc-labour-laws",
      "action": "POST /validate — validate both employees' new schedules against labour law constraints"
    },
    {
      "from": "skello-app",
      "to": "svc-events",
      "action": "POST /events — emit shift.swapped event for both affected employees"
    },
    {
      "from": "svc-events",
      "to": "svc-communications-v2",
      "action": "SQS email-normal — notify both employees of the shift swap"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-shift-swap",
      "type": "postgresql",
      "label": "skello_production",
      "description": "Updates user_id on both shift records atomically"
    },
    {
      "id": "dynamo-labour-laws-swap",
      "type": "dynamodb",
      "label": "svcLabourLaws-{env}",
      "description": "Labour law rules — validate both employees' resulting schedules"
    },
    {
      "id": "sqs-shift-swap",
      "type": "sqs",
      "label": "skello-sqs-events",
      "description": "Async event queue for shift swap notifications"
    },
    {
      "id": "dynamo-events-swap",
      "type": "dynamodb",
      "label": "svcEvents-{env}",
      "description": "Audit event store for shift.swapped"
    },
    {
      "id": "lambda-notify-swap",
      "type": "lambda",
      "label": "shift-notify-dispatch",
      "description": "Dispatches swap confirmation to both employees"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-shift-swap",
      "label": "atomic swap",
      "crud": ["update"]
    },
    {
      "from": "svc-labour-laws",
      "to": "dynamo-labour-laws-swap",
      "label": "read rules",
      "crud": ["read"]
    },
    {
      "from": "skello-app",
      "to": "sqs-shift-swap",
      "label": "enqueue"
    },
    {
      "from": "svc-events",
      "to": "dynamo-events-swap",
      "label": "write",
      "crud": ["create"]
    },
    {
      "from": "svc-communications-v2",
      "to": "lambda-notify-swap",
      "label": "invoke x2"
    }
  ]
})

export default shift_swap
