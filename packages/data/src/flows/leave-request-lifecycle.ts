import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Code layer traced 2026-07-11. The web front calls svc-requests DIRECTLY
// (SvcRequestsRepository); the monolith's V3::Api::LeaveRequestsController is
// the MOBILE surface, proxying to the same API. svc-requests runs
// CDC-as-event-bus on its own Aurora: a dedicated DMS task streams row changes
// onto the svcRequests kinesis stream, DecodeAndPublishRequestJobHandler
// republishes them to the SnsDispatch topic with computed `trigger` message
// attributes, and filtered SQS subscriptions fan out to mail/notification
// jobs. Earlier claims that the monolith emitted the audit event and the
// notification were wrong: svc-requests sends its own activity logs to
// svc-events and its own emails/notifications through the comms-v2 SDK.
const leave_request_lifecycle: ServiceFlow = ServiceFlowSchema.parse({
  "id": "leave-request-lifecycle",
  "name": "Leave Request Lifecycle",
  "description": "An employee submits a leave request. The web front calls svc-requests directly (the monolith v3 controller is the mobile proxy onto the same API). svc-requests persists the request in its own Aurora Postgres, sends an activity-log batch to svc-events (feature-flagged), and lets its CDC event spine do the notifying: a DMS task streams the row change onto the service's kinesis stream, DecodeAndPublishRequestJobHandler republishes to the SnsDispatch SNS topic with a computed trigger attribute, and the sendCreatedLeaveRequest mail + notification queues deliver the manager's email and in-app notification through svc-communications-v2.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-requests",
      "action": "POST /leave-requests — employee submits (web; SvcRequestsRepository.create)"
    },
    {
      "from": "skello-app",
      "to": "svc-requests",
      "action": "POST /leave-requests — mobile surface proxy (V3::Api::LeaveRequestsController#create)"
    },
    {
      "from": "svc-requests",
      "to": "svc-events",
      "action": "Activity-log batch via SQS (when activityLogInfos present — FF FEATUREDEV_ACTIVITY_LOGS_CANARY)"
    },
    {
      "from": "svc-requests",
      "to": "svc-communications-v2",
      "action": "Manager email + in-app notification (CDC → SNS fan-out → comms-v2 SDK)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-lrl-front-client",
      "service": "skello-app-front",
      "kind": "service",
      "label": "SvcRequestsClient",
      "path": "apps/vue-app/src/shared/utils/clients/svc_requests_client.js",
      "description": "Web client over @skelloapp/svc-requests-sdk (svcRequestsApiUrl) — create/update/delete/list leave requests without touching the monolith"
    },
    {
      "id": "cu-lrl-mono-proxy",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::LeaveRequestsController#create",
      "path": "app/controllers/v3/api/leave_requests_controller.rb",
      "description": "Mobile submission surface: authorizes, maps params (incl. activityLogInfos under the activity-logs canary FF) and proxies to svc-requests"
    },
    {
      "id": "cu-lrl-api",
      "service": "svc-requests",
      "kind": "controller",
      "label": "LeaveRequestController#createLeaveRequest",
      "path": "src/Controller/LeaveRequestController.ts",
      "description": "API entry — validates the DTO, fires the activity-log SQS message when activityLogInfos.isLogActivated, delegates to LeaveRequestManager"
    },
    {
      "id": "cu-lrl-manager",
      "service": "svc-requests",
      "kind": "manager",
      "label": "LeaveRequestManager",
      "path": "src/Manager/LeaveRequestManager.ts",
      "description": "Persists the leave request through LeaveRequestRepository (TypeORM → own Aurora Postgres)"
    },
    {
      "id": "cu-lrl-activity",
      "service": "svc-requests",
      "kind": "service",
      "label": "ActivityLogCreateSqs",
      "path": "src/Repository/SQS/ActivityLogCreateSqs.ts",
      "description": "Sends RawActivityLogBatchDto (svc-events-sdk contract) to svc-events' ingestion queue"
    },
    {
      "id": "cu-lrl-decode",
      "service": "svc-requests",
      "kind": "job",
      "label": "DecodeAndPublishRequestJobHandler",
      "path": "src/Handler/Job/DecodeAndPublishRequestJobHandler.ts",
      "description": "Consumes the service's own CDC kinesis stream, decodes before/after images and publishes to the SnsDispatch topic with computed trigger message attributes (created / accepted / refused / transferred / createShifts / sendToData)"
    },
    {
      "id": "cu-lrl-mail",
      "service": "svc-requests",
      "kind": "job",
      "label": "SendCreatedLeaveRequestEmailJobHandler",
      "path": "src/Handler/Job/Mails/SendCreatedLeaveRequestEmailJobHandler.ts",
      "description": "SQS consumer of the sendCreatedLeaveRequestMail-filtered SNS subscription"
    },
    {
      "id": "cu-lrl-email-mgr",
      "service": "svc-requests",
      "kind": "manager",
      "label": "LeaveRequestEmailManager",
      "path": "src/Manager/LeaveRequestEmailManager.ts",
      "description": "Builds the manager's email and sends it through the comms-v2 EmailRepository"
    },
    {
      "id": "cu-lrl-notif",
      "service": "svc-requests",
      "kind": "job",
      "label": "SendCreatedLeaveRequestNotificationJobHandler",
      "path": "src/Handler/Job/Notifications/SendCreatedLeaveRequestNotificationJobHandler.ts",
      "description": "SQS consumer of the sendCreatedLeaveRequestNotification-filtered SNS subscription"
    },
    {
      "id": "cu-lrl-notif-mgr",
      "service": "svc-requests",
      "kind": "manager",
      "label": "LeaveRequestNotificationManager",
      "path": "src/Manager/LeaveRequestNotificationManager.ts",
      "description": "Builds the in-app notification and sends it through the comms-v2 NotificationRepository"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-lrl-front-client",
      "label": "employee submits leave request",
      "mode": "sync"
    },
    {
      "from": "cu-lrl-front-client",
      "to": "svc-requests",
      "label": "SvcRequestsRepository.create → POST /leave-requests",
      "mode": "sync"
    },
    {
      "from": "cu-lrl-mono-proxy",
      "to": "svc-requests",
      "label": "Microservices::RequestService POST /leave-requests",
      "mode": "sync",
      "condition": "mobile app surface"
    },
    {
      "from": "svc-requests",
      "to": "cu-lrl-api",
      "label": "API GW route → LeaveRequestController#createLeaveRequest",
      "mode": "sync"
    },
    {
      "from": "cu-lrl-api",
      "to": "cu-lrl-manager",
      "label": "LeaveRequestManager#createLeaveRequest",
      "mode": "sync"
    },
    {
      "from": "cu-lrl-api",
      "to": "cu-lrl-activity",
      "label": "ActivityLogCreateSqs.sendMessage",
      "mode": "async-job",
      "condition": "activityLogInfos.isLogActivated (FF FEATUREDEV_ACTIVITY_LOGS_CANARY)"
    },
    {
      "from": "cu-lrl-activity",
      "to": "svc-events",
      "label": "RawActivityLogBatchDto → svc-events queue",
      "mode": "async-job"
    },
    {
      "from": "cu-lrl-manager",
      "to": "pg-requests",
      "label": "LeaveRequestRepository save",
      "mode": "sync",
      "crud": ["create"]
    },
    {
      "from": "pg-requests",
      "to": "kinesis-requests-cdc",
      "label": "DMS CDC (aurora replication task, svc-requests-tf)",
      "mode": "async-event"
    },
    {
      "from": "kinesis-requests-cdc",
      "to": "cu-lrl-decode",
      "label": "kinesis batch",
      "mode": "async-event"
    },
    {
      "from": "cu-lrl-decode",
      "to": "sns-dispatch-lrl",
      "label": "SnsDispatch publishBatch (computed trigger attributes)",
      "mode": "async-event"
    },
    {
      "from": "sns-dispatch-lrl",
      "to": "cu-lrl-mail",
      "label": "trigger sendCreatedLeaveRequestMail → SQS",
      "mode": "async-event"
    },
    {
      "from": "sns-dispatch-lrl",
      "to": "cu-lrl-notif",
      "label": "trigger sendCreatedLeaveRequestNotification → SQS",
      "mode": "async-event"
    },
    {
      "from": "cu-lrl-mail",
      "to": "cu-lrl-email-mgr",
      "label": "LeaveRequestEmailManager#handleCreatedLeaveRequestsEmails",
      "mode": "sync"
    },
    {
      "from": "cu-lrl-email-mgr",
      "to": "svc-communications-v2",
      "label": "EmailRepository (svc-communications-v2-sdk)",
      "mode": "sync"
    },
    {
      "from": "cu-lrl-notif",
      "to": "cu-lrl-notif-mgr",
      "label": "LeaveRequestNotificationManager#handleLeaveRequestNotificationEvents",
      "mode": "sync"
    },
    {
      "from": "cu-lrl-notif-mgr",
      "to": "svc-communications-v2",
      "label": "NotificationRepository (svc-communications-v2-sdk)",
      "mode": "sync"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-requests",
      "type": "postgresql",
      "label": "svc-requests Aurora",
      "description": "The service's own Postgres (TypeORM entities) — leave request rows"
    },
    {
      "id": "kinesis-requests-cdc",
      "type": "kinesis",
      "label": "svcRequests-{env}",
      "description": "The service's own CDC stream: a dedicated DMS aurora replication task streams row changes here (svc-requests-tf)"
    },
    {
      "id": "sns-dispatch-lrl",
      "type": "sns",
      "label": "SnsDispatch",
      "description": "Request-event fan-out topic — SQS subscriptions filter on the trigger message attribute"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-requests",
      "to": "pg-requests",
      "label": "leave requests",
      "crud": ["create", "read", "update"]
    }
  ]
})

export default leave_request_lifecycle
