import { ServiceFlowSchema } from '../schemas'
import type { ServiceFlow } from '../schemas'

const leave_request_lifecycle: ServiceFlow = ServiceFlowSchema.parse({
  "id": "leave-request-lifecycle",
  "name": "Leave Request Lifecycle",
  "description": "An employee submits a leave request from the frontend. The monolith persists it in svc-requests, logs an audit event, and emails the manager via svc-communications-v2.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST /v3/requests — submit leave request"
    },
    {
      "from": "skello-app",
      "to": "svc-requests",
      "action": "POST /requests — persist leave request"
    },
    {
      "from": "skello-app",
      "to": "svc-events",
      "action": "POST /events — log audit event"
    },
    {
      "from": "skello-app",
      "to": "svc-communications-v2",
      "action": "SQS email-high — notify manager"
    },
    {
      "from": "skello-app-front",
      "to": "svc-requests",
      "action": "GET /requests — refresh request list"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-requests",
      "type": "postgresql",
      "label": "requests-db",
      "description": "Stores all leave requests"
    },
    {
      "id": "dynamo-events",
      "type": "dynamodb",
      "label": "svcEvents-{env}",
      "description": "Audit event store"
    },
    {
      "id": "s3-events",
      "type": "s3",
      "label": "svc-events.{env}",
      "description": "Event payload archive"
    },
    {
      "id": "sqs-email-high",
      "type": "sqs",
      "label": "email-high",
      "description": "High-priority email queue"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-requests",
      "to": "pg-requests",
      "label": "write"
    },
    {
      "from": "svc-events",
      "to": "dynamo-events",
      "label": "write"
    },
    {
      "from": "svc-events",
      "to": "s3-events",
      "label": "archive"
    },
    {
      "from": "svc-communications-v2",
      "to": "sqs-email-high",
      "label": "enqueue"
    }
  ]
})

export default leave_request_lifecycle
