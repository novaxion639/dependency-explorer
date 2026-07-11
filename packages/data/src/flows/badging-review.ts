import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Companion to employee-clock-in (queued from that trace). Traced 2026-06-15:
// v3/api/badgings/{base,day_badgings,matched_badgings}_controller.rb →
// v3/matched_badgings/day_update_service.rb + microservices/punch clients.
// svc-punch is the system of record the review page reads — the badging
// mirror written during clock-in comes back here.
const badging_review: ServiceFlow = ServiceFlowSchema.parse({
  "id": "badging-review",
  "name": "Badging Review & Validation",
  "description": "A manager reviews the day's badgings against planned shifts in the badgings section. The list itself is READ FROM svc-punch (Punch::MsBadging.get_badgings — the mirror written during clock-in), along with adjustment history and the shop's arrival/departure rounding settings. Validating a day runs DayUpdateService: worked shifts are created/updated FROM the validated badgings (real Shift rows — the creation callback group fires), each adjustment is recorded back into svc-punch's history, and counters are recomputed (CombinedTrackerUpdateService + a forced PlanningHoursDatas recalculation job).",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "Badgings section — read day badgings + history, validate the day (badgings/{day,matched}_badgings controllers)"
    },
    {
      "from": "skello-app",
      "to": "svc-punch",
      "action": "Read badgings + history + rounding settings (Punch::MsBadging.get_badgings, HistoriesService, SettingService); write adjustment history on validation"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-br-read-surface",
      "service": "skello-app",
      "kind": "controller",
      "label": "badgings read surface (day list + history)",
      "path": "app/controllers/v3/api/badgings/base_controller.rb",
      "description": "Shared reads for the review page — badgings from Punch::MsBadging.get_badgings, adjustment history from Punch::HistoriesService; DayBadgingsController#index/#history serialize them (MsBadgingsSerializer)"
    },
    {
      "id": "cu-br-matched-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::Badgings::MatchedBadgingsController#bulk_update",
      "path": "app/controllers/v3/api/badgings/matched_badgings_controller.rb",
      "description": "Day validation entry — runs DayUpdateService, then counter recompute and a forced PlanningHoursDatas recalculation; also serves arrival/departure rounding settings from svc-punch"
    },
    {
      "id": "cu-br-update-service",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::MatchedBadgings::DayUpdateService",
      "path": "app/services/v3/matched_badgings/day_update_service.rb",
      "description": "The reconciliation core: creates/updates worked Shift rows from the validated badgings (the shift-creation callback group fires per shift) and records each adjustment in svc-punch's history"
    },
    {
      "id": "cu-br-histories",
      "service": "skello-app",
      "kind": "service",
      "label": "Microservices::Punch::HistoriesService",
      "path": "app/services/microservices/punch/histories_service.rb",
      "description": "HTTP client for svc-punch's badging-adjustment history (read for the page, create on validation)"
    },
    {
      "id": "cu-br-tracker",
      "service": "skello-app",
      "kind": "manager",
      "label": "V3::CombinedTrackerUpdateService",
      "path": "app/services/v3/combined_tracker_update_service.rb",
      "description": "Counter recompute for the validated users (PlanningHoursDatas + RCR + paid leaves)"
    },
    {
      "id": "cu-br-recalc-job",
      "service": "skello-app",
      "kind": "job",
      "label": "PlanningHoursDatas::RecalculJob",
      "path": "app/jobs/planning_hours_datas/recalcul_job.rb",
      "description": "Forced full recalculation of the week's planning hours after validation"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-br-read-surface",
      "label": "day badgings + history",
      "mode": "sync"
    },
    {
      "from": "cu-br-read-surface",
      "to": "svc-punch",
      "label": "get_badgings + histories",
      "mode": "sync"
    },
    {
      "from": "skello-app-front",
      "to": "cu-br-matched-controller",
      "label": "validate day (bulk_update)",
      "mode": "sync"
    },
    {
      "from": "cu-br-matched-controller",
      "to": "svc-punch",
      "label": "arrival/departure rounding settings",
      "mode": "sync"
    },
    {
      "from": "cu-br-matched-controller",
      "to": "cu-br-update-service",
      "label": "reconcile badgings → shifts",
      "mode": "sync"
    },
    {
      "from": "cu-br-update-service",
      "to": "pg-skello-badging-review",
      "label": "create/update worked shifts (creation callbacks fire)",
      "mode": "sync",
      "crud": ["create", "update"]
    },
    {
      "from": "cu-br-update-service",
      "to": "cu-br-histories",
      "label": "record adjustment",
      "mode": "sync"
    },
    {
      "from": "cu-br-histories",
      "to": "svc-punch",
      "label": "history create",
      "mode": "sync"
    },
    {
      "from": "cu-br-matched-controller",
      "to": "cu-br-tracker",
      "label": "recompute counters",
      "mode": "sync"
    },
    {
      "from": "cu-br-matched-controller",
      "to": "cu-br-recalc-job",
      "label": "force planning-hours recalculation",
      "mode": "async-job"
    },
    {
      "from": "cu-br-tracker",
      "to": "pg-skello-badging-review",
      "label": "counters",
      "mode": "sync",
      "crud": ["update"]
    },
    {
      "from": "pg-skello-badging-review",
      "to": "svc-search",
      "label": "DMS CDC → raw_shifts replica (validated shifts)",
      "mode": "async-event"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-badging-review",
      "type": "postgresql",
      "label": "skello_production — shifts, badgings, counters",
      "description": "Worked shifts created/updated from validated badgings + recomputed counter tables"
    },
    {
      "id": "redis-skello-badging-review",
      "type": "redis",
      "label": "skello-redis",
      "description": "Sidekiq broker for the recalculation job and the per-shift creation callbacks"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-skello-badging-review",
      "label": "worked shifts + counters",
      "crud": ["create", "update"]
    },
    {
      "from": "skello-app",
      "to": "redis-skello-badging-review",
      "label": "enqueue recalc"
    }
  ]
})

export default badging_review
