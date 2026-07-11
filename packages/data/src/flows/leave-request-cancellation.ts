import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Code layer traced 2026-07-11 — and the old flow's notification claim was a
// FABRICATION: deletion produces a CDC event like any row change, but the
// SnsDispatch fan-out has NO cancellation trigger (DecodeAndPublish computes
// created/accepted/refused/transferred/createShifts/sendToData only) and the
// createShifts FilterPolicy explicitly excludes deleted rows. Nobody is
// emailed or notified when a leave request is cancelled.
const leave_request_cancellation: ServiceFlow = ServiceFlowSchema.parse({
  "id": "leave-request-cancellation",
  "name": "Leave Request Cancellation",
  "description": "An employee (or manager) cancels a leave request — the web front calls svc-requests directly, the monolith v3 controller proxies the same DELETE for mobile. The request row is deleted in the service's Aurora; the change flows through the CDC stream into DecodeAndPublishRequestJobHandler like every row change, but NO SNS subscription matches a deletion: there is no cancellation trigger, and the createShifts FilterPolicy excludes deleted rows. Cancellation notifies nobody — the earlier 'notify manager or employee of cancellation' path never existed in code.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-requests",
      "action": "DELETE /leave-requests/{id} — cancel (web; SvcRequestsRepository.deleteById)"
    },
    {
      "from": "skello-app",
      "to": "svc-requests",
      "action": "DELETE /leave-requests/{id} — mobile surface proxy (V3::Api::LeaveRequestsController#destroy)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-lrc-front-client",
      "service": "skello-app-front",
      "kind": "service",
      "label": "SvcRequestsClient",
      "path": "apps/vue-app/src/shared/utils/clients/svc_requests_client.js",
      "description": "deleteLeaveRequest — direct DELETE against svc-requests"
    },
    {
      "id": "cu-lrc-mono-proxy",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::LeaveRequestsController#destroy",
      "path": "app/controllers/v3/api/leave_requests_controller.rb",
      "description": "Mobile cancellation surface — authorizes (can_create_self_leave_requests) and proxies the DELETE"
    },
    {
      "id": "cu-lrc-api",
      "service": "svc-requests",
      "kind": "controller",
      "label": "LeaveRequestController#deleteLeaveRequest",
      "path": "src/Controller/LeaveRequestController.ts",
      "description": "Loads the request (404 when absent) and delegates the deletion — no activity log on this path"
    },
    {
      "id": "cu-lrc-manager",
      "service": "svc-requests",
      "kind": "manager",
      "label": "LeaveRequestManager#deleteLeaveRequest",
      "path": "src/Manager/LeaveRequestManager.ts",
      "description": "Deletes through LeaveRequestRepository (TypeORM → own Aurora)"
    },
    {
      "id": "cu-lrc-decode",
      "service": "svc-requests",
      "kind": "job",
      "label": "DecodeAndPublishRequestJobHandler",
      "path": "src/Handler/Job/DecodeAndPublishRequestJobHandler.ts",
      "description": "Receives the deletion via CDC (subject REMOVE / deletedAt set) — but computes no matching trigger, so the SNS message fans out to nothing except the data-lake export"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-lrc-front-client",
      "label": "cancel leave request",
      "mode": "sync"
    },
    {
      "from": "cu-lrc-front-client",
      "to": "svc-requests",
      "label": "SvcRequestsRepository.deleteById → DELETE /leave-requests/{id}",
      "mode": "sync"
    },
    {
      "from": "cu-lrc-mono-proxy",
      "to": "svc-requests",
      "label": "Microservices::RequestService DELETE /leave-requests/{id}",
      "mode": "sync",
      "condition": "mobile app surface"
    },
    {
      "from": "svc-requests",
      "to": "cu-lrc-api",
      "label": "API GW route → LeaveRequestController#deleteLeaveRequest",
      "mode": "sync"
    },
    {
      "from": "cu-lrc-api",
      "to": "cu-lrc-manager",
      "label": "LeaveRequestManager#deleteLeaveRequest",
      "mode": "sync"
    },
    {
      "from": "cu-lrc-manager",
      "to": "pg-requests-cancel",
      "label": "LeaveRequestRepository delete",
      "mode": "sync",
      "crud": ["delete"]
    },
    {
      "from": "pg-requests-cancel",
      "to": "kinesis-requests-cdc-cancel",
      "label": "DMS CDC (aurora replication task)",
      "mode": "async-event"
    },
    {
      "from": "kinesis-requests-cdc-cancel",
      "to": "cu-lrc-decode",
      "label": "kinesis batch",
      "mode": "async-event"
    },
    {
      "from": "cu-lrc-decode",
      "to": "sns-dispatch-cancel",
      "label": "SnsDispatch publish — no subscription matches a deletion",
      "mode": "async-event",
      "condition": "no cancellation trigger exists; createShifts FilterPolicy excludes deleted rows"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-requests-cancel",
      "type": "postgresql",
      "label": "svc-requests Aurora",
      "description": "Leave request row removed"
    },
    {
      "id": "kinesis-requests-cdc-cancel",
      "type": "kinesis",
      "label": "svcRequests-{env}",
      "description": "The service's own CDC stream"
    },
    {
      "id": "sns-dispatch-cancel",
      "type": "sns",
      "label": "SnsDispatch",
      "description": "The request-event fan-out topic — deletions match no mail/notification/createShifts FilterPolicy (only the sendToData export sees them)"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-requests",
      "to": "pg-requests-cancel",
      "label": "delete request",
      "crud": ["delete"]
    }
  ]
})

export default leave_request_cancellation
