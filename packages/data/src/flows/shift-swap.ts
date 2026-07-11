import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Code layer traced 2026-07-11. A manager swap is not a dedicated backend
// operation: the planning drag-drop sends the regular bulk shift update
// (PATCH /v3/api/plannings/shifts) with the two user_ids exchanged —
// isSwappingUserShifts exists only in the FRONT store, which uses it to log
// an UPDATE_SWAP_USER_SHIFTS activity directly to svc-events (postOnSvcEvent).
// The old flow's monolith-emitted 'shift.swapped' event, skello-sqs-events
// queue and shift-notify-dispatch lambda never existed; employees are
// notified at planning publication only.
const shift_swap: ServiceFlow = ServiceFlowSchema.parse({
  "id": "shift-swap",
  "name": "Shift Swap Between Employees",
  "description": "A manager swaps two employees' shifts on the planning (drag-drop). The front sends the regular bulk shift update with the user_ids exchanged; V3::Shifts::UpdateService reassigns both rows in one transaction (labour-law compliance is evaluated in-process; stale employee ShiftSwap-request rows on the moved shifts are destroyed) and the usual counter/callback machinery runs. The swap-specific part lives in the FRONT: the store flags isSwappingUserShifts and posts an UPDATE_SWAP_USER_SHIFTS activity to svc-events itself. Nobody is notified — publication does that.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "PATCH /v3/api/plannings/shifts — bulk update with exchanged user_ids"
    },
    {
      "from": "skello-app-front",
      "to": "svc-events",
      "action": "UPDATE_SWAP_USER_SHIFTS activity (postOnSvcEvent, front-side)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-swap-store",
      "service": "skello-app-front",
      "kind": "service",
      "label": "plannings/shifts store — updateShifts",
      "path": "apps/vue-app/src/shared/store/modules/plannings/shifts.js",
      "description": "The drag-drop swap path: PATCHes the bulk update, then posts the UPDATE_SWAP_USER_SHIFTS activity to svc-events when isSwappingUserShifts, and refreshes alerts/counters/weekly options"
    },
    {
      "id": "cu-swap-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::Plannings::ShiftsController#update",
      "path": "app/controllers/v3/api/plannings/shifts_controller.rb",
      "description": "The regular bulk update surface — swaps carry no dedicated flag server-side"
    },
    {
      "id": "cu-swap-service",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::Shifts::UpdateService",
      "path": "app/services/v3/shifts/update_service.rb",
      "description": "Reassigns both shifts in one transaction; destroys ShiftSwap request rows attached to the updated shifts (employee swap-requests are voided by the manager's move)"
    },
    {
      "id": "cu-swap-callbacks",
      "service": "skello-app",
      "kind": "model-callback",
      "label": "Shift callbacks (after_save / after_commit)",
      "path": "app/models/concerns/shifts/callbacks_concern.rb",
      "description": "Weekly-option staleness, shift data refresh, paid-leave counters, PredictedShift upsert — fired for both reassigned shifts"
    },
    {
      "id": "cu-swap-tracker",
      "service": "skello-app",
      "kind": "manager",
      "label": "V3::CombinedTrackerUpdateService",
      "path": "app/services/v3/combined_tracker_update_service.rb",
      "description": "Hours / RCR / paid-leave counters recomputed for BOTH employees"
    },
    {
      "id": "cu-swap-cb-job",
      "service": "skello-app",
      "kind": "job",
      "label": "ShiftCallbackJob",
      "path": "app/jobs/shift_callback_job.rb",
      "description": "Marks both users' WeeklyOptions as not-up-to-date"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-swap-store",
      "label": "drag-drop swap on the planning",
      "mode": "sync"
    },
    {
      "from": "cu-swap-store",
      "to": "cu-swap-controller",
      "label": "PATCH /v3/api/plannings/shifts",
      "mode": "sync"
    },
    {
      "from": "cu-swap-store",
      "to": "svc-events",
      "label": "postOnSvcEvent UPDATE_SWAP_USER_SHIFTS",
      "mode": "async-event",
      "condition": "isSwappingUserShifts"
    },
    {
      "from": "cu-swap-controller",
      "to": "cu-swap-service",
      "label": ".run!",
      "mode": "sync",
      "inTransaction": true
    },
    {
      "from": "cu-swap-service",
      "to": "pg-skello-shifts-swap",
      "label": "reassign user_ids ×2 + ShiftSwap rows destroyed",
      "mode": "sync",
      "inTransaction": true,
      "crud": ["update", "delete"]
    },
    {
      "from": "cu-swap-service",
      "to": "cu-swap-tracker",
      "label": "recompute counters for both users",
      "mode": "sync"
    },
    {
      "from": "cu-swap-service",
      "to": "cu-swap-callbacks",
      "label": "AR commit lifecycle ×2",
      "mode": "sync"
    },
    {
      "from": "cu-swap-callbacks",
      "to": "cu-swap-cb-job",
      "label": "weekly-option staleness",
      "mode": "async-job"
    },
    {
      "from": "cu-swap-tracker",
      "to": "pg-skello-shifts-swap",
      "label": "PlanningHoursDatas + RCR + paid leaves",
      "mode": "sync",
      "crud": ["update"]
    },
    {
      "from": "pg-skello-shifts-swap",
      "to": "svc-search",
      "label": "DMS CDC → raw_shifts replica",
      "mode": "async-event"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-shifts-swap",
      "type": "postgresql",
      "label": "skello_production — shifts",
      "description": "Both shift rows reassigned; attached ShiftSwap request rows destroyed"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-skello-shifts-swap",
      "label": "swap update",
      "crud": ["update"]
    }
  ]
})

export default shift_swap
