import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Code layer traced 2026-06-12 (shifts_controller#destroy → destroy_service.rb
// → shift.rb after_destroy → delete_shift_documents_job.rb). The previously
// documented svc-shifts metrics call, shift.deleted event and notification
// email had NO code path and were removed; the REAL cross-service consequence
// nobody had documented is the documents cleanup in svc-documents-v2.
const shift_deletion: ServiceFlow = ServiceFlowSchema.parse({
  "id": "shift-deletion",
  "name": "Shift Deletion",
  "description": "A planner deletes a shift. The monolith destroys the row and synchronously recomputes the user's counters inside the transaction; after destruction, AR callbacks clean the first-shift cache, drop any future PredictedShift, and enqueue a Sidekiq job that deletes the shift's attached documents in svc-documents-v2. Deleting does NOT emit a svc-events activity nor notify the employee. (Corrected 2026-06-12.)",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "DELETE /v3/shifts/:id — delete shift"
    },
    {
      "from": "skello-app",
      "to": "svc-documents-v2",
      "action": "Delete the shift's attached documents (Microservices::DocumentsV2Service.delete_shift_documents, called from the async DeleteShiftDocumentsJob)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-del-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::Plannings::ShiftsController#destroy",
      "path": "app/controllers/v3/api/plannings/shifts_controller.rb",
      "description": "Guarded by can_create_shifts!; delegates to DestroyService, responds 204"
    },
    {
      "id": "cu-del-service",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::Shifts::DestroyService",
      "path": "app/services/v3/shifts/destroy_service.rb",
      "description": "Transaction: shift.destroy! then synchronous counter recompute (perform_now: true) for the assigned user"
    },
    {
      "id": "cu-del-callbacks",
      "service": "skello-app",
      "kind": "model-callback",
      "label": "Shift callbacks (after_destroy / after_commit)",
      "path": "app/models/shift.rb",
      "description": "after_destroy declarations live on the model itself (shift.rb:180-186): first-shift cache reload + delete_shift_documents!; manage_predicted_shift (body in callbacks_concern.rb) drops the PredictedShift when the deleted shift was in the future"
    },
    {
      "id": "cu-del-tracker",
      "service": "skello-app",
      "kind": "manager",
      "label": "V3::CombinedTrackerUpdateService",
      "path": "app/services/v3/combined_tracker_update_service.rb",
      "description": "Synchronous here (perform_now: true): PlanningHoursDatas + RCR + paid-leave counters for the user, inside the destroy transaction"
    },
    {
      "id": "cu-del-docs-job",
      "service": "skello-app",
      "kind": "job",
      "label": "Shifts::DeleteShiftDocumentsJob",
      "path": "app/jobs/shifts/delete_shift_documents_job.rb",
      "description": "Sidekiq (slow queue) — calls Microservices::DocumentsV2Service.delete_shift_documents per shift; failures captured to Sentry and logged"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-del-controller",
      "label": "DELETE /v3/shifts/:id",
      "mode": "sync"
    },
    {
      "from": "cu-del-controller",
      "to": "cu-del-service",
      "label": ".run!",
      "mode": "sync",
      "inTransaction": true
    },
    {
      "from": "cu-del-service",
      "to": "pg-skello-shifts-del",
      "label": "shift.destroy!",
      "mode": "sync",
      "inTransaction": true,
      "crud": ["delete"]
    },
    {
      "from": "cu-del-service",
      "to": "cu-del-tracker",
      "label": "recompute counters (perform_now)",
      "mode": "sync",
      "condition": "assigned shifts only",
      "inTransaction": true
    },
    {
      "from": "cu-del-tracker",
      "to": "pg-skello-counters-del",
      "label": "PlanningHoursDatas + RCR + paid leaves",
      "mode": "sync",
      "crud": ["update"]
    },
    {
      "from": "cu-del-service",
      "to": "cu-del-callbacks",
      "label": "AR destroy lifecycle",
      "mode": "sync"
    },
    {
      "from": "cu-del-callbacks",
      "to": "redis-skello-del",
      "label": "first-shift cache reload",
      "mode": "sync"
    },
    {
      "from": "cu-del-callbacks",
      "to": "pg-skello-shifts-del",
      "label": "PredictedShift destroy",
      "mode": "sync",
      "condition": "future shifts only",
      "crud": ["delete"]
    },
    {
      "from": "cu-del-callbacks",
      "to": "cu-del-docs-job",
      "label": "delete_shift_documents!",
      "mode": "async-job"
    },
    {
      "from": "cu-del-docs-job",
      "to": "svc-documents-v2",
      "label": "delete shift documents",
      "mode": "sync"
    },
    {
      "from": "pg-skello-shifts-del",
      "to": "svc-search",
      "label": "DMS CDC → raw_shifts replica (row removal)",
      "mode": "async-event"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-shifts-del",
      "type": "postgresql",
      "label": "skello_production — shifts, predicted_shifts",
      "description": "Shift row destroyed in the transaction; future PredictedShift dropped post-destroy"
    },
    {
      "id": "pg-skello-counters-del",
      "type": "postgresql",
      "label": "skello_production — planning_hours_datas, RCR & paid-leave counters",
      "description": "Counters recomputed synchronously inside the destroy transaction"
    },
    {
      "id": "redis-skello-del",
      "type": "redis",
      "label": "skello-redis",
      "description": "First-shift cache and Sidekiq broker (DeleteShiftDocumentsJob, slow queue)"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-skello-shifts-del",
      "label": "destroy shift",
      "crud": ["delete"]
    },
    {
      "from": "skello-app",
      "to": "pg-skello-counters-del",
      "label": "recompute counters",
      "crud": ["update"]
    },
    {
      "from": "skello-app",
      "to": "redis-skello-del",
      "label": "cache + Sidekiq"
    }
  ]
})

export default shift_deletion
