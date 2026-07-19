import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// P2 coverage arc, traced 2026-07-20. Soft-delete with a PII scrub edge case
// and CDC ripple into three service replicas.
const employee_archival: ServiceFlow = ServiceFlowSchema.parse({
  "id": "employee-archival",
  "name": "Employee Archival",
  "description": "A manager archives an employee. Soft-delete: users.archived_at/archived_by_id/archive_note are set — and the EMAIL IS NULLIFIED when the effective date is in the past (PII scrub; companion jobs remove_emails_from_archived_users / add_archived_to_user_email carry the email lifecycle). Synchronously hard-deletes pending future ShiftSwaps, pending future LeaveRequests and future-year HolidaySettings. Async fan-out: ArchiveShiftsJob backs up to 500 future shifts (ArchivedUserShiftsBackup, transactional) then unassigns work shifts where the shop allows unassigned or destroys them, deletes future PlanningHoursData and recomputes; availabilities destroyed once archived_at passes; paid-leave counters recalculated; Intercom flagged; activity logged to svc-events via SQS. The replica ripple rides the skelloapp-bus CDC: svc-users updates its user/email/license replicas on archivedAt change, svc-punch updates UserCache + every replicated punch user row (this is what revokes punch/mobile badge eligibility — no dedicated permission-recalc job exists), svc-search upserts the raw employee doc's archivedAt.",
  "trigger": { "actor": "manager", "role": "can_archive_and_restore_users over a managed employee" },
  "links": [
    { "to": "employee-onboarding", "kind": "domain-related", "note": "the lifecycle inverse — V3::Users::UnarchiveService is the in-repo mirror of this flow" }
  ],
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "PATCH /v3/api/users/:id/archive"
    },
    {
      "from": "skello-app",
      "to": "svc-events",
      "action": "employee_archived activity batch via SQS (ActivityLogService.create_batch_async)"
    },
    {
      "from": "skello-app",
      "to": "svc-users",
      "action": "CDC — skelloapp-bus users rows → UpdateUserFromSkelloAppJob (archivedAt + email/license replicas)"
    },
    {
      "from": "skello-app",
      "to": "svc-punch",
      "action": "CDC — UserSyncJob updates UserCache + replicated punch user rows (revokes badge eligibility)"
    },
    {
      "from": "skello-app",
      "to": "svc-search",
      "action": "CDC — ProcessSkelloAppDataHandlerJob upserts the raw employee doc's archivedAt"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-ea-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::UsersController#archive",
      "path": "app/controllers/v3/api/users_controller.rb",
      "description": "archive action — authorize employee self_or_managed_by_user? + highest_license can_archive_and_restore_users; impersonation tracked via true_user"
    },
    {
      "id": "cu-ea-archive-service",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::Users::ArchiveService",
      "path": "app/services/v3/users/archive_service.rb",
      "description": "Sets archived_at/by/note, nullifies email for past-dated archival, hard-deletes pending future swaps/leave-requests/holiday-settings, then fans out the async jobs"
    },
    {
      "id": "cu-ea-shifts-job",
      "service": "skello-app",
      "kind": "job",
      "label": "ArchiveShiftsJob",
      "path": "app/jobs/archive_shifts_job.rb",
      "description": "Backs up ≤500 future shifts into ArchivedUserShiftsBackup (transactional), unassigns or destroys them, deletes future PlanningHoursData and recomputes"
    },
    {
      "id": "cu-ea-avail-job",
      "service": "skello-app",
      "kind": "job",
      "label": "ArchiveAvailabilitiesJob",
      "path": "app/jobs/archive_availabilities_job.rb",
      "description": "Destroys availabilities once archived_at < today (also re-fired daily by UpdateArchivedUsersJob for yesterday's archives)"
    },
    {
      "id": "cu-ea-paidleaves-job",
      "service": "skello-app",
      "kind": "job",
      "label": "UpdatePaidLeavesCounterJob",
      "path": "app/jobs/update_paid_leaves_counter_job.rb",
      "description": "Recalculates paid-leave counters from archived_at"
    },
    {
      "id": "cu-ea-intercom-job",
      "service": "skello-app",
      "kind": "job",
      "label": "Intercom::UpdateUserArchivedJob",
      "path": "app/jobs/intercom/update_user_archived_job.rb",
      "description": "Flags the user archived in Intercom — only when currently_archived?"
    },
    {
      "id": "cu-ea-activitylog",
      "service": "skello-app",
      "kind": "client",
      "label": "Microservices::ActivityLogService",
      "path": "app/services/microservices/activity_log_service.rb",
      "description": "create_batch_async — employee_archived entry onto svc-events' createActivityLogJob SQS queue"
    },
    {
      "id": "cu-ea-history-model",
      "service": "skello-app",
      "kind": "model-callback",
      "label": "ActionHistoryItem.create_archived_user",
      "path": "app/models/action_history_item.rb",
      "description": "Audit row for the archive action"
    },
    {
      "id": "cu-ea-svcusers-job",
      "service": "svc-users",
      "kind": "job",
      "label": "UpdateUserFromSkelloAppJob",
      "path": "src/Job/UpdateUserFromSkelloAppJob.ts",
      "description": "CDC consumer — archivedAtChanged detection, updateOrCreate of replicated user + email/license/org rows"
    },
    {
      "id": "cu-ea-svcpunch-job",
      "service": "svc-punch",
      "kind": "job",
      "label": "UserSyncJob",
      "path": "src/Job/Sync/UserSyncJob.ts",
      "description": "CDC consumer — updates UserCache and every replicated punch user row with archivedAt (badge eligibility follows)"
    },
    {
      "id": "cu-ea-svcsearch-job",
      "service": "svc-search",
      "kind": "job",
      "label": "ProcessSkelloAppDataHandlerJob",
      "path": "src/Handler/ProcessSkelloAppDataHandlerJob.ts",
      "description": "Routes CDC records by table name; users → the employee collection upsert"
    },
    {
      "id": "cu-ea-svcsearch-repo",
      "service": "svc-search",
      "kind": "manager",
      "label": "per-table skelloApp managers (employee upsert)",
      "path": "src/Manager/EmployeeSkelloAppManager.ts",
      "description": "The users-table route of the CDC handler — upserts the raw employee Mongo doc incl. archivedAt (EmployeeCollectionRepository underneath)"
    }
  ],
  "codeEdges": [
    { "from": "skello-app-front", "to": "cu-ea-controller", "label": "PATCH archive", "mode": "sync" },
    { "from": "cu-ea-controller", "to": "cu-ea-archive-service", "label": "V3::Users::ArchiveService", "mode": "sync" },
    {
      "from": "cu-ea-archive-service", "to": "pg-skello-archival",
      "label": "archived_at/by/note + email=nil (past-dated) + delete pending swaps/leaves/holiday-settings",
      "mode": "sync", "crud": ["update", "delete"]
    },
    { "from": "cu-ea-archive-service", "to": "cu-ea-shifts-job", "label": "backup + unassign/destroy future shifts", "mode": "async-job" },
    { "from": "cu-ea-archive-service", "to": "cu-ea-avail-job", "label": "destroy availabilities", "mode": "async-job", "condition": "archived_at < today (checked in job)" },
    { "from": "cu-ea-archive-service", "to": "cu-ea-paidleaves-job", "label": "recalculate paid leaves", "mode": "async-job" },
    { "from": "cu-ea-archive-service", "to": "cu-ea-intercom-job", "label": "flag archived in Intercom", "mode": "async-job", "condition": "currently_archived?" },
    {
      "from": "cu-ea-archive-service", "to": "cu-ea-activitylog", "label": "employee_archived batch", "mode": "async-job"
    },
    {
      "from": "cu-ea-activitylog", "to": "svc-events", "label": "SQS createActivityLogJob", "mode": "async-job",
      "failure": { "queue": "createActivityLogJob", "dlq": "createActivityLogJobDlq", "retryPolicy": "maxReceiveCount 3", "onError": "A lost batch loses only the audit entry — archival itself is already committed" }
    },
    { "from": "cu-ea-archive-service", "to": "cu-ea-history-model", "label": "ActionHistoryItem audit", "mode": "sync", "condition": "currently_archived?", "crud": ["create"] },
    { "from": "cu-ea-shifts-job", "to": "pg-skello-archival", "label": "shift backup + unassign/destroy + PlanningHoursData", "mode": "sync", "inTransaction": true, "crud": ["create", "update", "delete"] },
    { "from": "pg-skello-archival", "to": "cu-ea-svcusers-job", "label": "skelloapp-bus CDC (users)", "mode": "async-event" },
    { "from": "pg-skello-archival", "to": "cu-ea-svcpunch-job", "label": "skelloapp-bus CDC (users)", "mode": "async-event" },
    { "from": "pg-skello-archival", "to": "cu-ea-svcsearch-job", "label": "skelloapp-bus CDC (users)", "mode": "async-event" },
    { "from": "cu-ea-svcsearch-job", "to": "cu-ea-svcsearch-repo", "label": "users-table route → employee upsert", "mode": "sync", "crud": ["update"] }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-archival",
      "type": "postgresql",
      "label": "skello_production — users, shifts, availabilities, counters, archived_user_shifts_backup",
      "description": "Soft-deleted user + cascaded rows; the CDC bus replicates the users table outward"
    },
    {
      "id": "redis-skello-archival",
      "type": "redis",
      "label": "skello-redis",
      "description": "Sidekiq broker for the archival job fan-out"
    }
  ],
  "infraEdges": [
    { "from": "skello-app", "to": "pg-skello-archival", "label": "archival writes", "crud": ["update", "delete"] },
    { "from": "skello-app", "to": "redis-skello-archival", "label": "enqueue archival jobs" }
  ]
})

export default employee_archival
