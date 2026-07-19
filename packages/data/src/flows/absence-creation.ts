import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Code layer added 2026-07-11 — the absence path IS the shift-creation path
// (V3::Shifts::CreateService) with the absence branches active; units and
// edges below are the ones verified for the shift-creation flagship. The
// remaining fabrications from the old narrative were removed with it: no
// skello-sqs-events queue, no shift-notify-dispatch lambda, no
// svc-events → comms notification — employees hear about planning changes
// at PUBLICATION only (see shift-publication).
const absence_creation: ServiceFlow = ServiceFlowSchema.parse({
  "id": "absence-creation",
  "name": "Absence Creation",
  "description": "A manager records an absence (paid leave, sick day…) for an employee. Absences are shifts with an absence type: the same V3::Shifts::CreateService transaction runs with the absence branches active — sick-leave duration recomputation (feature-flagged), conflict resolution that unassigns overlapping work shifts (ShiftReplacementService), paid-leave counter updates — and the absence-only ActivityJob posts the audit event to svc-events. Labour-law entitlements are evaluated in-process (rules previously synced from svc-labour-laws). Nobody is notified at this point; employee notifications happen at planning publication.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST /v3/shifts — create shift(s) with an absence type"
    },
    {
      "from": "skello-app",
      "to": "svc-events",
      "action": "Audit activity via ActivityJob (absence shifts only)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-abs-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::Plannings::ShiftsController#create",
      "path": "app/controllers/v3/api/plannings/shifts_controller.rb",
      "description": "Same creation surface as work shifts — the absence semantics come from the shift params (absence type, calculation)"
    },
    {
      "id": "cu-abs-create-service",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::Shifts::CreateService",
      "path": "app/services/v3/shifts/create_service.rb",
      "description": "One ActiveRecord transaction: validation, absence conflict resolution, persistence, audit and counter updates"
    },
    {
      "id": "cu-abs-sick-leave",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::Shifts::SickLeaveDurationService",
      "path": "app/services/v3/shifts/sick_leave_duration_service.rb",
      "description": "Recomputes absence durations for sick-leave batches (all-or-nothing applicability check)"
    },
    {
      "id": "cu-abs-replacement",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::Shifts::ShiftReplacementService",
      "path": "app/services/v3/shifts/shift_replacement_service.rb",
      "description": "The absence-defining branch: overlapping work shifts move to unassigned and ShiftReplacement rows record the displacement (undo data)"
    },
    {
      "id": "cu-abs-callbacks",
      "service": "skello-app",
      "kind": "model-callback",
      "label": "Shift callbacks (after_save / after_commit)",
      "path": "app/models/concerns/shifts/callbacks_concern.rb",
      "description": "after_commit chain — weekly-option staleness, shift data refresh, paid-leave counters (the counter that absences actually consume)"
    },
    {
      "id": "cu-abs-activity-job",
      "service": "skello-app",
      "kind": "job",
      "label": "ActivityJob",
      "path": "app/jobs/activity_job.rb",
      "description": "Sidekiq audit job — fires for absence shifts only, posting the activity to svc-events"
    },
    {
      "id": "cu-abs-tracker",
      "service": "skello-app",
      "kind": "manager",
      "label": "V3::CombinedTrackerUpdateService",
      "path": "app/services/v3/combined_tracker_update_service.rb",
      "description": "Hours / RCR / paid-leave counter updates for the affected users"
    },
    {
      "id": "cu-abs-paid-leaves-job",
      "service": "skello-app",
      "kind": "job",
      "label": "UpdatePaidLeavesCounterJob",
      "path": "app/jobs/update_paid_leaves_counter_job.rb",
      "description": "Recomputes the user's paid-leave counter from the absence start date"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-abs-controller",
      "label": "POST /v3/shifts (absence type)",
      "mode": "sync"
    },
    {
      "from": "cu-abs-controller",
      "to": "cu-abs-create-service",
      "label": ".run!",
      "mode": "sync",
      "inTransaction": true
    },
    {
      "from": "cu-abs-create-service",
      "to": "cu-abs-sick-leave",
      "label": "recompute sick-leave durations",
      "mode": "sync",
      "condition": "FF: FEATUREDEV_CANARY_CORRECT_OVERTIME",
      "inTransaction": true,
      "flags": [{ "name": "FEATUREDEV_CANARY_CORRECT_OVERTIME", "kind": "dev" }]
    },
    {
      "from": "cu-abs-create-service",
      "to": "cu-abs-replacement",
      "label": "unassign overlapping work shifts",
      "mode": "sync",
      "condition": "absence over existing shifts",
      "inTransaction": true
    },
    {
      "from": "cu-abs-create-service",
      "to": "pg-absence",
      "label": "Shift.create! (absence) + ShiftReplacement rows",
      "mode": "sync",
      "inTransaction": true,
      "crud": ["create"]
    },
    {
      "from": "cu-abs-create-service",
      "to": "cu-abs-tracker",
      "label": "update counters for the absent user",
      "mode": "sync",
      "condition": "assigned shifts; enqueued when perform_later",
      "inTransaction": true
    },
    {
      "from": "cu-abs-create-service",
      "to": "cu-abs-activity-job",
      "label": "perform_later — audit",
      "mode": "async-job",
      "condition": "absence shifts only"
    },
    {
      "from": "cu-abs-create-service",
      "to": "cu-abs-callbacks",
      "label": "AR commit lifecycle",
      "mode": "sync"
    },
    {
      "from": "cu-abs-callbacks",
      "to": "cu-abs-paid-leaves-job",
      "label": "paid-leave counters",
      "mode": "async-job"
    },
    {
      "from": "cu-abs-tracker",
      "to": "pg-absence",
      "label": "PlanningHoursDatas + RCR + paid leaves",
      "mode": "sync",
      "crud": ["update"]
    },
    {
      "from": "cu-abs-activity-job",
      "to": "svc-events",
      "label": "POST /events — absence activity",
      "mode": "sync"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-absence",
      "type": "postgresql",
      "label": "skello_production — shifts",
      "description": "Absences are shift rows with an absence type; ShiftReplacement rows keep the displaced work shifts recoverable"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-absence",
      "label": "absence shift + counters",
      "crud": ["create", "update"]
    }
  ]
})

export default absence_creation
