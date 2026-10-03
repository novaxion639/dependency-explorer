import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Code layer traced 2026-07-11. The monolith v3 controller has NO update
// action — managers process requests straight from the web front against
// svc-requests (SvcRequestsRepository.updateById). The earlier flow's
// 'svc-events → comms' notification step and 'request-notify-dispatch'
// lambda never existed: the fan-out is svc-requests' own CDC → SnsDispatch
// with accepted/refused triggers, and acceptance ALSO fires the createShifts
// trigger → CreateShiftsJob → SkelloAppManager write-back that
// creates the absence shifts in the monolith (POST /private/shifts).
const leave_request_approval: ServiceFlow = ServiceFlowSchema.parse({
  "id": "leave-request-approval",
  "name": "Leave Request Approval / Rejection",
  "description": "A manager accepts or refuses a leave request from the web front, directly against svc-requests (PATCH — the monolith has no update proxy). The status change lands in the service's Aurora, its CDC stream carries it to DecodeAndPublishRequestJob, and the SnsDispatch topic fans out: sendAccepted/RefusedLeaveRequest mail + notification queues deliver the employee's email and in-app notification via svc-communications-v2; on acceptance the createShifts trigger additionally runs CreateShiftsJob → SkelloAppManager, the strangler write-back that creates the absence shifts in the monolith planning (with RetryCreateShiftsJob as the DLQ retry path).",
  "trigger": {"actor": "manager"},
  "primaryArea": "leave-requests",
  "chapters": [
    { "title": "A manager accepts or refuses", "summary": "The web front sends the decision straight to svc-requests; skello-app is not in the request path.", "refs": ["skello-app-front", "cu-lra-front-client", "svc-requests", "cu-lra-api"] },
    { "title": "The decision is saved", "summary": "svc-requests rejects requests no longer pending or for archived staff, saves the status and logs the activity when asked.", "refs": ["cu-lra-manager", "pg-requests-approval", "svc-events"] },
    { "title": "The change fans out", "summary": "The database change stream reaches a job that publishes mail, notification and shift triggers on one topic.", "refs": ["kinesis-requests-cdc-approval", "cu-lra-decode", "sns-dispatch-lra"] },
    { "title": "The employee hears back", "summary": "Email and notification jobs build the decision messages and send them through svc-communications-v2.", "refs": ["cu-lra-mail", "cu-lra-email-mgr", "cu-lra-notif", "cu-lra-notif-mgr", "svc-communications-v2"] },
    { "title": "Absence shifts are created", "summary": "On acceptance, a job posts the absence shifts to skello-app, which writes them under a lock and reports dropped days.", "refs": ["cu-lra-create-shifts", "cu-lra-skello-mgr", "skello-app", "cu-lra-mono-shifts"] }
  ],
  "links": [{"to": "shift-creation", "kind": "writes-back-to", "note": "CreateShiftsJob POSTs /private/shifts \u2014 the shift-creation domain action through a private strangler entry point, not the modeled /v3/shifts path"}],
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-requests",
      "action": "PATCH /leave-requests/{id} — manager accepts or refuses (SvcRequestsRepository.updateById)"
    },
    {
      "from": "svc-requests",
      "to": "svc-communications-v2",
      "action": "Employee decision email + in-app notification (CDC → SNS fan-out → comms-v2 SDK)"
    },
    {
      "from": "svc-requests",
      "to": "skello-app",
      "action": "POST /private/shifts — create absence shifts on acceptance (CreateShiftsJob write-back)"
    },
    {
      "from": "svc-requests",
      "to": "svc-events",
      "action": "Activity-log batch via SQS (when activityLogInfos present on the update)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-lra-mono-shifts",
      "service": "skello-app",
      "kind": "controller",
      "label": "Private::SvcRequests::ShiftsController#create",
      "path": "app/controllers/private/svc_requests/shifts_controller.rb",
      "description": "Creates the absence shifts under a pg advisory lock (Persisters::LeaveRequestAbsenceCreator); answers 409 when the lock is held, 200 with dropped_absences when some days were invalid, 204 otherwise"
    },
    {
      "id": "cu-lra-front-client",
      "service": "skello-app-front",
      "kind": "service",
      "label": "SvcRequestsClient",
      "path": "apps/vue-app/src/shared/utils/clients/svc_requests_client.js",
      "description": "updateLeaveRequest — the manager's accept/refuse goes straight to svc-requests"
    },
    {
      "id": "cu-lra-api",
      "service": "svc-requests",
      "kind": "controller",
      "label": "LeaveRequestController#updateLeaveRequest",
      "path": "src/Controller/LeaveRequestController.ts",
      "description": "Validates the status transition, fires the activity-log SQS message when requested, delegates to LeaveRequestManager"
    },
    {
      "id": "cu-lra-manager",
      "service": "svc-requests",
      "kind": "manager",
      "label": "LeaveRequestManager",
      "path": "src/Manager/LeaveRequestManager.ts",
      "description": "Updates the request status through LeaveRequestRepository (TypeORM → own Aurora)"
    },
    {
      "id": "cu-lra-decode",
      "service": "svc-requests",
      "kind": "job",
      "label": "DecodeAndPublishRequestJob",
      "path": "src/Job/DecodeAndPublishRequestJob.ts",
      "description": "CDC consumer — computes accepted/refused mail+notification triggers and, for accepted requests, the createShifts trigger"
    },
    {
      "id": "cu-lra-mail",
      "service": "svc-requests",
      "kind": "job",
      "label": "SendProcessedLeaveRequestEmailJob",
      "path": "src/Job/Mails/SendProcessedLeaveRequestEmailJob.ts",
      "description": "Consumes BOTH the sendAccepted- and sendRefused-LeaveRequestMail queues (two SNS subscriptions, one handler)"
    },
    {
      "id": "cu-lra-email-mgr",
      "service": "svc-requests",
      "kind": "manager",
      "label": "LeaveRequestEmailManager",
      "path": "src/Manager/LeaveRequestEmailManager.ts",
      "description": "Builds the decision email and sends it through the comms-v2 EmailRepository"
    },
    {
      "id": "cu-lra-notif",
      "service": "svc-requests",
      "kind": "job",
      "label": "SendProcessedLeaveRequestNotificationJob",
      "path": "src/Job/Notifications/SendProcessedLeaveRequestNotificationJob.ts",
      "description": "Consumes the accepted/refused notification queues"
    },
    {
      "id": "cu-lra-notif-mgr",
      "service": "svc-requests",
      "kind": "manager",
      "label": "LeaveRequestNotificationManager",
      "path": "src/Manager/LeaveRequestNotificationManager.ts",
      "description": "Builds the in-app decision notification (comms-v2 NotificationRepository)"
    },
    {
      "id": "cu-lra-create-shifts",
      "service": "svc-requests",
      "kind": "job",
      "label": "CreateShiftsJob",
      "path": "src/Job/CreateShiftsJob.ts",
      "description": "Consumes the createShifts-filtered queue (accepted, not deleted); RetryCreateShiftsJob replays its DLQ"
    },
    {
      "id": "cu-lra-skello-mgr",
      "service": "svc-requests",
      "kind": "manager",
      "label": "SkelloAppManager",
      "path": "src/Manager/SkelloAppManager.ts",
      "description": "Strangler write-back client — POST /private/shifts on the monolith (SSM SKELLO_APP_API_URL + SKELLO_APP_REQUESTS_API_KEY)"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-lra-front-client",
      "label": "manager accepts / refuses",
      "mode": "sync"
    },
    {
      "from": "cu-lra-front-client",
      "to": "svc-requests",
      "label": "SvcRequestsRepository.updateById → PATCH /leave-requests/{id}",
      "mode": "sync"
    },
    {
      "from": "svc-requests",
      "to": "cu-lra-api",
      "label": "API GW route → LeaveRequestController#updateLeaveRequest",
      "mode": "sync"
    },
    {
      "from": "cu-lra-api",
      "to": "cu-lra-manager",
      "label": "LeaveRequestManager update",
      "mode": "sync"
    },
    {
      "from": "cu-lra-api",
      "to": "svc-events",
      "label": "ActivityLogCreateSqs.sendMessage",
      "mode": "async-job",
      "condition": "activityLogInfos present",
      "failure": {
        "queue": "createActivityLogJob",
        "dlq": "createActivityLogJobDlq",
        "retryPolicy": "maxReceiveCount 3",
        "onError": "Failed activity-log batches land in the DLQ; the leave-request decision itself is unaffected — the loss is audit-trail only"
      }
    },
    {
      "from": "cu-lra-manager",
      "to": "pg-requests-approval",
      "label": "status update",
      "mode": "sync",
      "crud": ["update"]
    },
    {
      "from": "pg-requests-approval",
      "to": "kinesis-requests-cdc-approval",
      "label": "DMS CDC (aurora replication task)",
      "mode": "async-event"
    },
    {
      "from": "kinesis-requests-cdc-approval",
      "to": "cu-lra-decode",
      "label": "kinesis batch",
      "mode": "async-event"
    },
    {
      "from": "cu-lra-decode",
      "to": "sns-dispatch-lra",
      "label": "SnsDispatch publishBatch (computed trigger attributes)",
      "mode": "async-event"
    },
    {
      "from": "sns-dispatch-lra",
      "to": "cu-lra-mail",
      "label": "trigger sendAccepted/RefusedLeaveRequestMail → SQS",
      "mode": "async-event"
    },
    {
      "from": "sns-dispatch-lra",
      "to": "cu-lra-notif",
      "label": "trigger sendAccepted/RefusedLeaveRequestNotification → SQS",
      "mode": "async-event"
    },
    {
      "from": "sns-dispatch-lra",
      "to": "cu-lra-create-shifts",
      "label": "trigger createShifts → SQS",
      "mode": "async-event",
      "condition": "status accepted AND not deleted (SNS FilterPolicy)"
    },
    {
      "from": "cu-lra-mail",
      "to": "cu-lra-email-mgr",
      "label": "LeaveRequestEmailManager processed emails",
      "mode": "sync"
    },
    {
      "from": "cu-lra-email-mgr",
      "to": "svc-communications-v2",
      "label": "EmailRepository (svc-communications-v2-sdk)",
      "mode": "sync"
    },
    {
      "from": "cu-lra-notif",
      "to": "cu-lra-notif-mgr",
      "label": "LeaveRequestNotificationManager events",
      "mode": "sync"
    },
    {
      "from": "cu-lra-notif-mgr",
      "to": "svc-communications-v2",
      "label": "NotificationRepository (svc-communications-v2-sdk)",
      "mode": "sync"
    },
    {
      "from": "cu-lra-create-shifts",
      "to": "cu-lra-skello-mgr",
      "label": "SkelloAppManager create shifts",
      "mode": "sync"
    },
    {
      "from": "cu-lra-skello-mgr",
      "to": "skello-app",
      "label": "POST /private/requests/shifts (absence shifts)",
      "mode": "sync"
    },
    {
      "from": "skello-app",
      "to": "cu-lra-mono-shifts",
      "label": "Private::SvcRequests::ShiftsController#create",
      "mode": "sync"
    }
  ],
  "branches": [
    {
      "id": "not-pending",
      "at": "cu-lra-manager",
      "when": "the request is no longer pending (already accepted or refused)",
      "outcome": "422 Unprocessable Entity, nothing updated",
      "status": 422,
      "evidence": { "literal": "'Request is processed'" }
    },
    {
      "id": "archived-employee",
      "at": "cu-lra-manager",
      "when": "accepting for an employee archived before the leave starts or ends",
      "outcome": "422 Unprocessable Entity, nothing updated",
      "status": 422,
      "evidence": { "literal": "'Employee is archived'" }
    },
    {
      "id": "lock-held",
      "at": "cu-lra-mono-shifts",
      "when": "a concurrent delivery of the same leave request holds the advisory lock (BR-15280)",
      "outcome": "409 Conflict, no absence shifts written by this delivery",
      "status": 409,
      "evidence": { "literal": "return render_conflict unless lock_acquired" }
    },
    {
      "id": "dropped-absences",
      "at": "cu-lra-mono-shifts",
      "when": "some absence shifts are invalid and dropped",
      "outcome": "200 with dropped_absences — valid shifts persisted, svc-requests logs the missing days",
      "status": 200,
      "evidence": { "literal": "dropped_absences: creator.dropped_absences" }
    }
  ],
  "infraNodes": [
    {
      "id": "pg-requests-approval",
      "type": "postgresql",
      "label": "svc-requests Aurora",
      "resources": ["pg:svcrequests"],
      "description": "Persists the accepted/refused status"
    },
    {
      "id": "kinesis-requests-cdc-approval",
      "type": "kinesis",
      "label": "svcRequests-{env}",
      "resources": ["kinesis:svcRequests"],
      "description": "The service's own CDC stream (dedicated DMS aurora replication task)"
    },
    {
      "id": "sns-dispatch-lra",
      "type": "sns",
      "label": "SnsDispatch",
      "resources": ["sns:dispatch"],
      "description": "Request-event fan-out topic — SQS subscriptions filter on the trigger message attribute"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-requests",
      "to": "pg-requests-approval",
      "label": "status update",
      "crud": ["update"]
    }
  ]
})

export default leave_request_approval
