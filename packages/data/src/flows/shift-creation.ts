import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Flagship deep flow — code layer traced 2026-06-11 from skello-app source
// (controller → create_service.rb → callbacks_concern.rb → jobs). Every
// codeUnit.path is checker-verified to exist; every codeEdge callee is
// checker-verified to be referenced from its caller's file.
const shift_creation: ServiceFlow = ServiceFlowSchema.parse({
  "id": "shift-creation",
  "name": "Shift Creation",
  "description": "A planner creates a shift on the planning page. The monolith validates params, persists the shift to PostgreSQL within a transaction, runs sync tracker updates, then AR commit callbacks fan out three Sidekiq jobs (weekly-option staleness, shift data, paid-leave counters). For absence shifts only, an ActivityJob posts an audit event to svc-events. Labour law compliance is NOT checked at creation — alerts are fetched separately via GET /alerts. The created row also reaches svc-search's raw_shifts replica via DMS CDC, powering auto-scheduling and BFF reads.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "GET /v3/plannings — load planning context (employees, shops)"
    },
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST /v3/shifts — create new shift (sync response with created shift)"
    },
    {
      "from": "skello-app",
      "to": "svc-events",
      "action": "POST /events — audit event via ActivityJob (async Sidekiq, absence shifts only)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-shifts-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::Plannings::ShiftsController#create",
      "path": "app/controllers/v3/api/plannings/shifts_controller.rb",
      "description": "Guarded by can_create_shifts!; delegates to CreateService and serializes the created shifts (V3::ShiftSerializer)"
    },
    {
      "id": "cu-create-service",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::Shifts::CreateService",
      "path": "app/services/v3/shifts/create_service.rb",
      "description": "Orchestrates the whole creation inside one ActiveRecord transaction: param validation, conflict resolution, persistence, audit and counter updates"
    },
    {
      "id": "cu-sick-leave-service",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::Shifts::SickLeaveDurationService",
      "path": "app/services/v3/shifts/sick_leave_duration_service.rb",
      "description": "Recomputes absence durations for sick-leave batches (all-or-nothing applicability check)"
    },
    {
      "id": "cu-replacement-service",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::Shifts::ShiftReplacementService",
      "path": "app/services/v3/shifts/shift_replacement_service.rb",
      "description": "Resolves conflicts when an absence lands on existing work shifts — moves them to unassigned and records ShiftReplacement rows"
    },
    {
      "id": "cu-shift-callbacks",
      "service": "skello-app",
      "kind": "model-callback",
      "label": "Shift callbacks (after_save / after_commit)",
      "path": "app/models/concerns/shifts/callbacks_concern.rb",
      "description": "after_save: first-shift Redis cache reload. after_commit ×4: weekly-option staleness, shift data refresh, paid-leave counters, PredictedShift upsert (punch-clock prediction)"
    },
    {
      "id": "cu-activity-job",
      "service": "skello-app",
      "kind": "job",
      "label": "ActivityJob",
      "path": "app/jobs/activity_job.rb",
      "description": "Sidekiq audit job — posts the shift.created activity to svc-events with shop/user context"
    },
    {
      "id": "cu-tracker-service",
      "service": "skello-app",
      "kind": "manager",
      "label": "V3::CombinedTrackerUpdateService",
      "path": "app/services/v3/combined_tracker_update_service.rb",
      "description": "Fans into three counter updaters: V3::PlanningHoursDatas::UpdateService, V3::RCR::UpdateService, V3::PaidLeavesCounters::UpdateService — each runs inline or as a job depending on perform_now"
    },
    {
      "id": "cu-shift-callback-job",
      "service": "skello-app",
      "kind": "job",
      "label": "ShiftCallbackJob",
      "path": "app/jobs/shift_callback_job.rb",
      "description": "Marks the user's WeeklyOption as not-up-to-date for the shift's week"
    },
    {
      "id": "cu-shift-data-job",
      "service": "skello-app",
      "kind": "job",
      "label": "Shifts::ShiftDataUpdaterJob",
      "path": "app/jobs/shifts/shift_data_updater_job.rb",
      "description": "Refreshes the denormalized shift_data payload for the created shift"
    },
    {
      "id": "cu-paid-leaves-job",
      "service": "skello-app",
      "kind": "job",
      "label": "UpdatePaidLeavesCounterJob",
      "path": "app/jobs/update_paid_leaves_counter_job.rb",
      "description": "Recomputes the user's paid-leave counter from the shift's start date"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-shifts-controller",
      "label": "POST /v3/shifts",
      "mode": "sync"
    },
    {
      "from": "cu-shifts-controller",
      "to": "cu-create-service",
      "label": ".run!",
      "mode": "sync",
      "inTransaction": true
    },
    {
      "from": "cu-create-service",
      "to": "cu-sick-leave-service",
      "label": "recompute sick-leave durations",
      "mode": "sync",
      "condition": "FF: FEATUREDEV_CANARY_CORRECT_OVERTIME",
      "inTransaction": true
    },
    {
      "from": "cu-create-service",
      "to": "cu-replacement-service",
      "label": "resolve conflicts → unassign work shifts",
      "mode": "sync",
      "condition": "absence over existing shifts",
      "inTransaction": true
    },
    {
      "from": "cu-create-service",
      "to": "pg-skello-shifts",
      "label": "Shift.create! (+ ShiftReplacement on undo)",
      "mode": "sync",
      "inTransaction": true,
      "crud": ["create"]
    },
    {
      "from": "cu-create-service",
      "to": "cu-tracker-service",
      "label": "update counters for assigned users",
      "mode": "sync",
      "condition": "assigned shifts; enqueued when perform_later",
      "inTransaction": true
    },
    {
      "from": "cu-create-service",
      "to": "cu-activity-job",
      "label": "perform_later — audit",
      "mode": "async-job",
      "condition": "absence shifts only"
    },
    {
      "from": "cu-create-service",
      "to": "cu-shift-callbacks",
      "label": "AR commit lifecycle",
      "mode": "sync"
    },
    {
      "from": "cu-tracker-service",
      "to": "pg-skello-counters",
      "label": "PlanningHoursDatas + RCR + paid leaves",
      "mode": "sync",
      "crud": ["update"]
    },
    {
      "from": "cu-shift-callbacks",
      "to": "redis-skello-shifts",
      "label": "first-shift cache reload",
      "mode": "sync"
    },
    {
      "from": "cu-shift-callbacks",
      "to": "pg-skello-shifts",
      "label": "PredictedShift upsert",
      "mode": "sync",
      "condition": "future shifts, within shop hours",
      "crud": ["create", "delete"]
    },
    {
      "from": "cu-shift-callbacks",
      "to": "cu-shift-callback-job",
      "label": "weekly-option staleness",
      "mode": "async-job"
    },
    {
      "from": "cu-shift-callbacks",
      "to": "cu-shift-data-job",
      "label": "shift data refresh",
      "mode": "async-job"
    },
    {
      "from": "cu-shift-callbacks",
      "to": "cu-paid-leaves-job",
      "label": "paid-leave counters",
      "mode": "async-job"
    },
    {
      "from": "cu-activity-job",
      "to": "svc-events",
      "label": "POST /events — shift.created",
      "mode": "sync"
    },
    {
      "from": "pg-skello-shifts",
      "to": "svc-search",
      "label": "DMS CDC → raw_shifts replica (read by auto-scheduling & BFF)",
      "mode": "async-event"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-shifts",
      "type": "postgresql",
      "label": "skello_production — shifts, shift_replacements, predicted_shifts",
      "description": "Shift rows persisted within the ActiveRecord transaction; PredictedShift upserts arrive post-commit from the callback group"
    },
    {
      "id": "pg-skello-counters",
      "type": "postgresql",
      "label": "skello_production — planning_hours_datas, RCR & paid-leave counters",
      "description": "Counter tables recomputed by CombinedTrackerUpdateService for every assigned user"
    },
    {
      "id": "redis-skello-shifts",
      "type": "redis",
      "label": "skello-redis",
      "description": "First-shift cache (after_save) and the Sidekiq broker carrying every async-job edge of this flow"
    },
    {
      "id": "dynamo-events-shift",
      "type": "dynamodb",
      "label": "svcEvents-{env}",
      "description": "Audit event store — BatchWriteItem for shift.created (absence shifts only)"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-skello-shifts",
      "label": "persist shift + trackers",
      "crud": ["create"]
    },
    {
      "from": "skello-app",
      "to": "pg-skello-counters",
      "label": "recompute counters",
      "crud": ["update"]
    },
    {
      "from": "skello-app",
      "to": "redis-skello-shifts",
      "label": "cache refresh + enqueue Sidekiq jobs"
    },
    {
      "from": "svc-events",
      "to": "dynamo-events-shift",
      "label": "BatchWriteItem",
      "crud": ["create"]
    }
  ]
})

export default shift_creation
