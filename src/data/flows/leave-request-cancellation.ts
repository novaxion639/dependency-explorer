import { ServiceFlowSchema } from '../schemas'
import type { ServiceFlow } from '../schemas'

const leave_request_cancellation: ServiceFlow = ServiceFlowSchema.parse({
  "id": "leave-request-cancellation",
  "name": "Leave Request Cancellation",
  "description": "An employee or manager cancels a previously submitted leave request. The monolith removes it from svc-requests, logs an audit event, and notifies the other party via email.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "DELETE /v3/requests/:id — cancel leave request"
    },
    {
      "from": "skello-app",
      "to": "svc-requests",
      "action": "DELETE /leave-requests/:id — remove leave request"
    },
    {
      "from": "skello-app",
      "to": "svc-events",
      "action": "POST /events — emit request.cancelled event"
    },
    {
      "from": "svc-events",
      "to": "svc-communications-v2",
      "action": "SQS email-high — notify manager or employee of cancellation"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-requests-cancel",
      "type": "postgresql",
      "label": "svc_requests",
      "description": "Removes the leave request row"
    },
    {
      "id": "sqs-request-cancel",
      "type": "sqs",
      "label": "svc-requests-sns",
      "description": "SNS-backed queue for request lifecycle events"
    },
    {
      "id": "dynamo-events-req-cancel",
      "type": "dynamodb",
      "label": "svcEvents-{env}",
      "description": "Audit event store for request.cancelled"
    },
    {
      "id": "lambda-notify-req-cancel",
      "type": "lambda",
      "label": "request-notify-dispatch",
      "description": "Dispatches leave request cancellation notification"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-requests",
      "to": "pg-requests-cancel",
      "label": "delete"
    },
    {
      "from": "svc-requests",
      "to": "sqs-request-cancel",
      "label": "enqueue"
    },
    {
      "from": "svc-events",
      "to": "dynamo-events-req-cancel",
      "label": "write"
    },
    {
      "from": "svc-communications-v2",
      "to": "lambda-notify-req-cancel",
      "label": "invoke"
    }
  ]
})

export default leave_request_cancellation
