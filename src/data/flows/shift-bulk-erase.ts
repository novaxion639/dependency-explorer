import { ServiceFlowSchema } from '../schemas'
import type { ServiceFlow } from '../schemas'

const shift_bulk_erase: ServiceFlow = ServiceFlowSchema.parse({
  "id": "shift-bulk-erase",
  "name": "Bulk Erase Shifts",
  "description": "A manager erases all shifts for a day, week or month in one action. The monolith bulk-deletes the records, updates shop and org planning metrics in svc-shifts, and emits an event for audit purposes.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "DELETE /v3/api/plannings/bulk_delete — erase all shifts for the selected period and shop"
    },
    {
      "from": "skello-app",
      "to": "svc-shifts",
      "action": "POST /shift-metrics/shop-and-orga — recompute shop and org metrics after bulk deletion"
    },
    {
      "from": "skello-app",
      "to": "svc-events",
      "action": "POST /events — emit shifts.bulk-deleted event for audit trail"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-bulk-erase",
      "type": "postgresql",
      "label": "skello_production",
      "description": "Bulk-deletes shift records for the selected period"
    },
    {
      "id": "mongo-shifts-erase",
      "type": "mongodb",
      "label": "svc-shifts",
      "description": "Shop and org planning metrics recomputed after deletion"
    },
    {
      "id": "dynamo-events-erase",
      "type": "dynamodb",
      "label": "svcEvents-{env}",
      "description": "Audit event store for shifts.bulk-deleted"
    },
    {
      "id": "sqs-bulk-erase",
      "type": "sqs",
      "label": "skello-sqs-events",
      "description": "Async event queue for bulk shift lifecycle events"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-bulk-erase",
      "label": "bulk delete",
      "crud": ["delete"]
    },
    {
      "from": "svc-shifts",
      "to": "mongo-shifts-erase",
      "label": "write metrics",
      "crud": ["update"]
    },
    {
      "from": "skello-app",
      "to": "sqs-bulk-erase",
      "label": "enqueue"
    },
    {
      "from": "svc-events",
      "to": "dynamo-events-erase",
      "label": "write",
      "crud": ["create"]
    }
  ]
})

export default shift_bulk_erase
