import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Code layer traced 2026-07-11. The audit event is FRONT-side: the store's
// deleteShifts action posts a BULK_DELETE activity to svc-events itself
// (postOnSvcEvent) — the monolith emits nothing (the old skello-sqs-events
// queue never existed). Assigned shifts are destroyed one by one so the
// document-cleanup callbacks fire; unassigned shifts take the fast
// delete_all path with no callbacks.
const shift_bulk_erase: ServiceFlow = ServiceFlowSchema.parse({
  "id": "shift-bulk-erase",
  "name": "Bulk Erase Shifts",
  "description": "A manager erases the shifts of a period (or of selected employees) in one action. The front DELETEs /v3/api/plannings/shifts/bulk_delete and logs the BULK_DELETE activity to svc-events itself. In the monolith, BulkDestroyService destroys assigned shifts WITH callbacks (so DeleteShiftDocumentsJob cleans their documents in svc-documents-v2), fast-deletes unassigned shifts without callbacks, purges the attached PredictedShift / ShiftSwap / ShiftReplacement rows, and recomputes the affected users' counters. When employees are selected, BulkDestroyByUsersService resolves their shift ids first.",
  "trigger": {"actor": "manager", "role": "planner"},
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "DELETE /v3/api/plannings/shifts/bulk_delete — by period or by selected user_ids"
    },
    {
      "from": "skello-app-front",
      "to": "svc-events",
      "action": "BULK_DELETE activity (postOnSvcEvent, front-side)"
    },
    {
      "from": "skello-app",
      "to": "svc-documents-v2",
      "action": "Delete documents of destroyed shifts (DeleteShiftDocumentsJob, per assigned shift)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-bulk-store",
      "service": "skello-app-front",
      "kind": "service",
      "label": "plannings/shifts store — deleteShifts",
      "path": "apps/vue-app/src/shared/store/modules/plannings/shifts.js",
      "description": "Sends the bulk delete, posts the BULK_DELETE activity to svc-events, refreshes counters/alerts"
    },
    {
      "id": "cu-bulk-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::Plannings::ShiftsController#bulk_delete",
      "path": "app/controllers/v3/api/plannings/shifts_controller.rb",
      "description": "Routes to BulkDestroyByUsersService when user_ids are present, BulkDestroyService for shift_ids"
    },
    {
      "id": "cu-bulk-by-users",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::Shifts::BulkDestroyByUsersService",
      "path": "app/services/v3/shifts/bulk_destroy_by_users_service.rb",
      "description": "Resolves the selected employees' shifts over the period, then delegates to BulkDestroyService"
    },
    {
      "id": "cu-bulk-destroy",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::Shifts::BulkDestroyService",
      "path": "app/services/v3/shifts/bulk_destroy_service.rb",
      "description": "Assigned shifts destroyed one by one (callbacks fire); unassigned shifts delete_all (no callbacks); purges PredictedShift / ShiftSwap / ShiftReplacement rows; triggers counter recomputation"
    },
    {
      "id": "cu-bulk-callbacks",
      "service": "skello-app",
      "kind": "model-callback",
      "label": "Shift callbacks (after_destroy / after_commit)",
      "path": "app/models/shift.rb",
      "description": "after_destroy delete_shift_documents! — fires for each destroyed assigned shift"
    },
    {
      "id": "cu-bulk-docs-job",
      "service": "skello-app",
      "kind": "job",
      "label": "Shifts::DeleteShiftDocumentsJob",
      "path": "app/jobs/shifts/delete_shift_documents_job.rb",
      "description": "Removes the shift's documents through Microservices::DocumentsV2Service"
    },
    {
      "id": "cu-bulk-tracker",
      "service": "skello-app",
      "kind": "manager",
      "label": "V3::CombinedTrackerUpdateService",
      "path": "app/services/v3/combined_tracker_update_service.rb",
      "description": "Hours / RCR / paid-leave counters recomputed for every affected user"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-bulk-store",
      "label": "erase day / week / month",
      "mode": "sync"
    },
    {
      "from": "cu-bulk-store",
      "to": "cu-bulk-controller",
      "label": "DELETE bulk_delete",
      "mode": "sync"
    },
    {
      "from": "cu-bulk-store",
      "to": "svc-events",
      "label": "postOnSvcEvent BULK_DELETE",
      "mode": "async-event",
      "failure": {
        "dlqAbsent": "confirmed-missing",
        "onError": "HTTP fire-and-forget event post — no queue, no retry, no DLQ on this hop; a lost BULK_DELETE event silently misses the activity log"
      }
    },
    {
      "from": "cu-bulk-controller",
      "to": "cu-bulk-by-users",
      "label": "V3::Shifts::BulkDestroyByUsersService",
      "mode": "sync",
      "condition": "user_ids present"
    },
    {
      "from": "cu-bulk-controller",
      "to": "cu-bulk-destroy",
      "label": "V3::Shifts::BulkDestroyService",
      "mode": "sync",
      "condition": "shift_ids present"
    },
    {
      "from": "cu-bulk-by-users",
      "to": "cu-bulk-destroy",
      "label": "V3::Shifts::BulkDestroyService",
      "mode": "sync"
    },
    {
      "from": "cu-bulk-destroy",
      "to": "pg-bulk-erase",
      "label": "destroy assigned (callbacks) + delete_all unassigned + purge PredictedShift/ShiftSwap/ShiftReplacement",
      "mode": "sync",
      "crud": ["delete"]
    },
    {
      "from": "cu-bulk-destroy",
      "to": "cu-bulk-callbacks",
      "label": "AR destroy lifecycle",
      "mode": "sync",
      "condition": "assigned shifts only"
    },
    {
      "from": "cu-bulk-destroy",
      "to": "cu-bulk-tracker",
      "label": "recompute counters",
      "mode": "sync"
    },
    {
      "from": "cu-bulk-callbacks",
      "to": "cu-bulk-docs-job",
      "label": "delete_shift_documents!",
      "mode": "async-job"
    },
    {
      "from": "cu-bulk-docs-job",
      "to": "svc-documents-v2",
      "label": "delete shift documents",
      "mode": "sync"
    },
    {
      "from": "cu-bulk-tracker",
      "to": "pg-bulk-erase",
      "label": "PlanningHoursDatas + RCR + paid leaves",
      "mode": "sync",
      "crud": ["update"]
    },
    {
      "from": "pg-bulk-erase",
      "to": "svc-search",
      "label": "DMS CDC → raw_shifts replica (row removals)",
      "mode": "async-event"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-bulk-erase",
      "type": "postgresql",
      "label": "skello_production — shifts",
      "description": "Shift rows removed for the period; PredictedShift / ShiftSwap / ShiftReplacement rows purged"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-bulk-erase",
      "label": "bulk delete",
      "crud": ["delete"]
    }
  ]
})

export default shift_bulk_erase
