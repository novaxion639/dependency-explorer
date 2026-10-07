import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Code layer traced from skello-app source (shifts_controller#update
// → update_service.rb → callbacks_concern.rb), verified at @3f6728f. The update
// action calls no svc-shifts client, enqueues no ActivityJob and notifies nobody.
const shift_update: ServiceFlow = ServiceFlowSchema.parse({
  "id": "shift-update",
  "name": "Shift Update",
  "description": "A planner edits an existing shift. The monolith validates the params, the planning-day lock and shop membership, then persists the change inside a transaction, where Shift model validations run on update!; labour-law compliance is not checked at update — alerts are fetched separately. AR commit callbacks then fan out the same three Sidekiq jobs as creation and upsert the shift's PredictedShift. Updating emits no svc-events activity and notifies nobody — notifications happen at planning publication; there is no svc-shifts metrics call, shift.updated event or notification email.",
  "trigger": {"actor": "manager", "role": "planner"},
  "primaryArea": "planning",
  "chapters": [
    { "title": "A planner edits a shift", "summary": "The planning page sends the change; skello-app checks the planner may update shifts and passes on the skip-validation and undo flags.", "refs": ["skello-app-front", "cu-upd-controller"] },
    { "title": "Clashes and replacements resolve", "summary": "Inside one transaction, an absence over work shifts unassigns them, and a manual replacement unassigns and records a replacement row.", "refs": ["cu-upd-service", "cu-upd-replacement", "pg-skello-shifts-upd"] },
    { "title": "The shift is saved", "summary": "The shift row is updated; when the shift loses its employee, its punch-clock badging is unlinked.", "refs": ["cu-upd-service", "pg-skello-shifts-upd"] },
    { "title": "Counters recompute", "summary": "Hours, RCR and paid-leave counters update for both the old and the new assignee, still inside the transaction.", "refs": ["cu-upd-tracker", "pg-skello-counters-upd"] },
    { "title": "The cache refreshes after save", "summary": "The same callbacks as creation reload the first-shift cache and upsert the shift's predicted shift when it starts after the next shop opening.", "refs": ["cu-upd-callbacks", "redis-skello-upd"] },
    { "title": "Three background jobs follow", "summary": "Through Sidekiq, jobs mark the week's options stale, refresh the shift data payload and recompute paid-leave counters.", "refs": ["cu-upd-callbacks", "redis-skello-upd", "cu-upd-cb-job", "cu-upd-data-job", "cu-upd-pl-job"] },
    { "title": "The row is replicated", "summary": "DMS copies the updated row to svc-search. No event or employee notice is sent; that waits for planning publication.", "refs": ["pg-skello-shifts-upd", "svc-search"] }
  ],
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "PATCH /v3/api/plannings/shifts — update shift"
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
      "label": "PATCH /v3/api/plannings/shifts",
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
      "to": "pg-skello-shifts-upd",
      "label": "PredictedShift upsert",
      "mode": "sync",
      "condition": "starts at or after the next shop opening time",
      "crud": ["create", "update"]
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
  "branches": [
    {
      "id": "period-locked",
      "at": "cu-upd-service",
      "when": "the shift's new or previous day is locked on the planning (validated, permanent or intermediate lock) and not listed in skip_validation",
      "outcome": "403 Forbidden (Skello::IllegalOperation); the transaction rolls back",
      "status": 403,
      "evidence": { "literal": "validate_operation_allowed_for_day(shift_starts_at, 'update')" }
    },
    {
      "id": "invalid-work-shift",
      "at": "cu-upd-service",
      "when": "work-shift params carry absence-only fields (hours_worth or day_absence)",
      "outcome": "422 Unprocessable Entity (Skello::InvalidParams); the transaction rolls back",
      "status": 422,
      "evidence": { "literal": "validate_work_shift_params(shift_params)" }
    }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-shifts-upd",
      "type": "postgresql",
      "label": "skello_production — shifts, shift_replacements, badgings, predicted_shifts",
      "resources": ["pg:skello_production.shifts", "pg:skello_production.shift_replacements", "pg:skello_production.badgings", "pg:skello_production.predicted_shifts"],
      "description": "Shift row updated in the transaction; badging detached when the shift is unassigned; the PredictedShift is upserted post-commit by the callback group"
    },
    {
      "id": "pg-skello-counters-upd",
      "type": "postgresql",
      "label": "skello_production — planning_hours_datas, RCR & paid-leave counters",
      "resources": ["pg:skello_production.planning_hours_data", "pg:skello_production.rcr_counters", "pg:skello_production.paid_leaves_counters"],
      "description": "Counter tables recomputed for old and new assignees"
    },
    {
      "id": "redis-skello-upd",
      "type": "redis",
      "label": "skello-redis",
      "resources": ["redis:skelloApp-valkey"],
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
