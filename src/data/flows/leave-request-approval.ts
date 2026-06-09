import { ServiceFlowSchema } from '../schemas'
import type { ServiceFlow } from '../schemas'

const leave_request_approval: ServiceFlow = ServiceFlowSchema.parse({
  "id": "leave-request-approval",
  "name": "Leave Request Approval / Rejection",
  "description": "A manager approves or rejects an employee’s leave request. The monolith updates the request status in svc-requests, logs an audit event, and notifies the employee of the decision via email.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "PATCH /v3/requests/:id — approve or reject leave request"
    },
    {
      "from": "skello-app",
      "to": "svc-requests",
      "action": "PATCH /leave-requests/:id — update request status"
    },
    {
      "from": "skello-app",
      "to": "svc-events",
      "action": "POST /events — emit request.approved or request.rejected event"
    },
    {
      "from": "svc-events",
      "to": "svc-communications-v2",
      "action": "SQS email-high — notify employee of manager decision"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-requests-approval",
      "type": "postgresql",
      "label": "svc_requests",
      "description": "Persists the updated request status (approved / rejected)"
    },
    {
      "id": "sqs-request-approval",
      "type": "sqs",
      "label": "svc-requests-sns",
      "description": "SNS-backed queue for request lifecycle events"
    },
    {
      "id": "dynamo-events-req-approval",
      "type": "dynamodb",
      "label": "svcEvents-{env}",
      "description": "Audit event store for request.approved / request.rejected"
    },
    {
      "id": "lambda-notify-req-approval",
      "type": "lambda",
      "label": "request-notify-dispatch",
      "description": "Dispatches leave request decision notification to the employee"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-requests",
      "to": "pg-requests-approval",
      "label": "update status",
      "crud": ["update"]
    },
    {
      "from": "svc-requests",
      "to": "sqs-request-approval",
      "label": "enqueue"
    },
    {
      "from": "svc-events",
      "to": "dynamo-events-req-approval",
      "label": "write",
      "crud": ["create"]
    },
    {
      "from": "svc-communications-v2",
      "to": "lambda-notify-req-approval",
      "label": "invoke"
    }
  ]
})

export default leave_request_approval
