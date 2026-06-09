import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

const shift_creation: ServiceFlow = ServiceFlowSchema.parse({
  "id": "shift-creation",
  "name": "Shift Creation",
  "description": "A planner creates a shift on the planning page. The monolith validates params, persists the shift to PostgreSQL within a transaction, runs sync tracker updates, then enqueues async Sidekiq jobs for cache refreshes. For absence shifts only, an ActivityJob posts an audit event to svc-events. Labour law compliance is NOT checked at creation — alerts are fetched separately via GET /alerts.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-bff-planning",
      "action": "GET /planning — load planning context (employees, shops)"
    },
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST /v3/shifts — create new shift (sync response with created shift)"
    },
    {
      "from": "skello-app",
      "to": "svc-events",
      "action": "POST /events — audit event via ActivityJob (async Sidekiq, absence shifts only)"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-shifts",
      "type": "postgresql",
      "label": "skello_production",
      "description": "Persists the shift row within an ActiveRecord transaction. Also triggers after_commit Sidekiq jobs for cache updates (WeeklyOption, shift data, paid leaves)."
    },
    {
      "id": "redis-skello-shifts",
      "type": "redis",
      "label": "skello-redis",
      "description": "First-shift cache refresh (after_save) and Sidekiq job broker for async callbacks"
    },
    {
      "id": "dynamo-events-shift",
      "type": "dynamodb",
      "label": "svcEvents-{env}",
      "description": "Audit event store — BatchWriteItem for shift.created (absence shifts only)"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-skello-shifts",
      "label": "persist shift + trackers",
      "crud": ["create"]
    },
    {
      "from": "skello-app",
      "to": "redis-skello-shifts",
      "label": "cache refresh + enqueue Sidekiq jobs"
    },
    {
      "from": "svc-events",
      "to": "dynamo-events-shift",
      "label": "BatchWriteItem",
      "crud": ["create"]
    }
  ]
})

export default shift_creation
