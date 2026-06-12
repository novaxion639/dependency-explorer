import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Code layer traced 2026-06-12 from skello-app source (shifts_controller#update
// → update_service.rb → callbacks_concern.rb). The previously documented
// downstream half (svc-shifts metrics, svc-events shift.updated, comms email)
// had NO code path — the update action neither calls svc-shifts (no client in
// the monolith), nor enqueues ActivityJob, nor notifies anyone. Removed.
const shift_update: ServiceFlow = ServiceFlowSchema.parse({
  "id": "shift-update",
  "name": "Shift Update",
  "description": "A planner edits an existing shift. The monolith evaluates labour-law compliance in-process (rules previously synced from svc-labour-laws — no per-operation HTTP call) and persists the change inside a transaction; AR commit callbacks then fan out the same three Sidekiq jobs as creation. Updating does NOT emit a svc-events activity nor notify the employee — notifications happen at planning publication. (Corrected 2026-06-12: the previously documented svc-shifts metrics call, shift.updated event and notification email had no code path.)",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "PATCH /v3/shifts/:id — update shift"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-upd-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::Plannings::ShiftsController#update",
      "path": "app/controllers/v3/api/plannings/shifts_controller.rb",
      "description": "Guarded by can_update_shifts!; delegates to UpdateService with skip_validation / is_undo flags"
    },
    {
      "id": "cu-upd-service",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::Shifts::UpdateService",
      "path": "app/services/v3/shifts/update_service.rb",
      "description": "Transactional update: absence-conflict resolution, manual replacements, shift.update!, badging unlink when unassigning (punch-clock coupling), tracker recompute"
    },
    {
      "id": "cu-upd-replacement",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::Shifts::ShiftReplacementService",
      "path": "app/services/v3/shifts/shift_replacement_service.rb",
      "description": "Two contexts: absence landing on existing work shifts (conflict → unassign) and explicit manual replacements (unassign + ShiftReplacement row)"
    },
    {
      "id": "cu-upd-callbacks",
      "service": "skello-app",
      "kind": "model-callback",
      "label": "Shift callbacks (after_save / after_commit)",
      "path": "app/models/concerns/shifts/callbacks_concern.rb",
      "description": "Same group as creation: first-shift Redis cache, weekly-option staleness, shift data refresh, paid-leave counters, PredictedShift upsert"
    },
    {
      "id": "cu-upd-tracker",
      "service": "skello-app",
      "kind": "manager",
      "label": "V3::CombinedTrackerUpdateService",
      "path": "app/services/v3/combined_tracker_update_service.rb",
      "description": "Recomputes PlanningHoursDatas + RCR + paid-leave counters for affected users (old and new assignee)"
    },
    {
      "id": "cu-upd-cb-job",
      "service": "skello-app",
      "kind": "job",
      "label": "ShiftCallbackJob",
      "path": "app/jobs/shift_callback_job.rb",
      "description": "Marks the user's WeeklyOption as not-up-to-date"
    },
    {
      "id": "cu-upd-data-job",
      "service": "skello-app",
      "kind": "job",
      "label": "Shifts::ShiftDataUpdaterJob",
      "path": "app/jobs/shifts/shift_data_updater_job.rb",
      "description": "Refreshes the denormalized shift_data payload"
    },
    {
      "id": "cu-upd-pl-job",
      "service": "skello-app",
      "kind": "job",
      "label": "UpdatePaidLeavesCounterJob",
      "path": "app/jobs/update_paid_leaves_counter_job.rb",
      "description": "Recomputes the user's paid-leave counter"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-upd-controller",
      "label": "PATCH /v3/shifts/:id",
      "mode": "sync"
    },
    {
      "from": "cu-upd-controller",
      "to": "cu-upd-service",
      "label": ".run!",
      "mode": "sync",
      "inTransaction": true
    },
    {
      "from": "cu-upd-service",
      "to": "cu-upd-replacement",
      "label": "conflicts + manual replacements",
      "mode": "sync",
      "condition": "absence over shifts / replacement requested",
      "inTransaction": true
    },
    {
      "from": "cu-upd-service",
      "to": "pg-skello-shifts-upd",
      "label": "shift.update! (+ badging unlink on unassign)",
      "mode": "sync",
      "inTransaction": true,
      "crud": ["update"]
    },
    {
      "from": "cu-upd-service",
      "to": "cu-upd-tracker",
      "label": "recompute counters",
      "mode": "sync",
      "condition": "assigned users",
      "inTransaction": true
    },
    {
      "from": "cu-upd-service",
      "to": "cu-upd-callbacks",
      "label": "AR commit lifecycle",
      "mode": "sync"
    },
    {
      "from": "cu-upd-tracker",
      "to": "pg-skello-counters-upd",
      "label": "PlanningHoursDatas + RCR + paid leaves",
      "mode": "sync",
      "crud": ["update"]
    },
    {
      "from": "cu-upd-callbacks",
      "to": "redis-skello-upd",
      "label": "first-shift cache",
      "mode": "sync"
    },
    {
      "from": "cu-upd-callbacks",
      "to": "cu-upd-cb-job",
      "label": "weekly-option staleness",
      "mode": "async-job"
    },
    {
      "from": "cu-upd-callbacks",
      "to": "cu-upd-data-job",
      "label": "shift data refresh",
      "mode": "async-job"
    },
    {
      "from": "cu-upd-callbacks",
      "to": "cu-upd-pl-job",
      "label": "paid-leave counters",
      "mode": "async-job"
    },
    {
      "from": "pg-skello-shifts-upd",
      "to": "svc-search",
      "label": "DMS CDC → raw_shifts replica",
      "mode": "async-event"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-shifts-upd",
      "type": "postgresql",
      "label": "skello_production — shifts, shift_replacements, badgings",
      "description": "Shift row updated in the transaction; badging detached when the shift is unassigned"
    },
    {
      "id": "pg-skello-counters-upd",
      "type": "postgresql",
      "label": "skello_production — planning_hours_datas, RCR & paid-leave counters",
      "description": "Counter tables recomputed for old and new assignees"
    },
    {
      "id": "redis-skello-upd",
      "type": "redis",
      "label": "skello-redis",
      "description": "First-shift cache and Sidekiq broker for the async-job edges"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-skello-shifts-upd",
      "label": "update shift",
      "crud": ["update"]
    },
    {
      "from": "skello-app",
      "to": "pg-skello-counters-upd",
      "label": "recompute counters",
      "crud": ["update"]
    },
    {
      "from": "skello-app",
      "to": "redis-skello-upd",
      "label": "cache + Sidekiq"
    }
  ]
})

export default shift_update
