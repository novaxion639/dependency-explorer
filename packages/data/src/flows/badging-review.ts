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
  "description": "A manager reviews the day's badgings against planned shifts in the time-management tab. The badging list is READ FROM svc-punch through the monolith (Punch::MsBadging.get_badgings — svc-punch is the system of record for raw clock-ins), and the tab is NOT live: no polling or websocket, the day snapshot refetches on mount/date-change/save only. Punch settings are the exception — the front reads AND edits them DIRECTLY against svc-punch (punch_client.js, FactoryPunchWeb), and a store comment ('Will not be useful when svc punch fully in production') marks the badging list itself as mid-migration. DAY ATTRIBUTION is the overnight hotspot, computed against the shop's opening/closing hours (no overnight flag exists — over_midnight? = opening.hour >= closing.hour): a badging belongs to the shop-day whose opening-hour window contains it (Badging#day_index; 30-min pre-opening buffer, Sunday→Monday week-boundary special case), shifts bucket via Shift#badging_date_at_opening (previsional_start preferred), and badging↔shift matching uses a 1.5h window (SHIFT_MATCHING_TIME_WINDOW — deliberately reduced from 2h to stop late-Sunday badges matching early-Monday shifts). Validating a day runs DayUpdateService under a pg advisory lock: the PLANNED Shift row is updated IN PLACE with badging-derived times (the original plan survives only in previsional_* columns — no parallel worked-shift row; previsional_saved marks validation), unmatched badgings create new shifts, ends_at rolls +1 day whenever ends <= starts (the 22:00→02:00 build), manager-edited hours resolve to a calendar day via a ±12h heuristic, adjustments are recorded into svc-punch AFTER commit, and counters recompute (CombinedTrackerUpdateService + forced PlanningHoursDatas recalculation).",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "Badgings section — read day badgings + history, validate the day (badgings/{day,matched}_badgings controllers)"
    },
    {
      "from": "skello-app-front",
      "to": "svc-punch",
      "action": "Punch settings read/edit DIRECT (punch_client.js — FactoryPunchWeb: getSetting/partialUpdateSetting/getUsers)"
    },
    {
      "from": "skello-app",
      "to": "svc-punch",
      "action": "Read badgings + history + rounding settings (Punch::MsBadging.get_badgings, HistoriesService, SettingService); write adjustment history on validation (after commit)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-br-front-page",
      "service": "skello-app-front",
      "kind": "component",
      "label": "Badgings.vue — time-management tab",
      "path": "apps/vue-app/src/badgings/Badgings.vue",
      "description": "Routes /v3/shops/:id/badgings (days | users | history sub-views); initial load dispatches weekly options, teams, users then the day badging data. No polling/websocket — the day snapshot is static between saves"
    },
    {
      "id": "cu-br-front-store",
      "service": "skello-app-front",
      "kind": "service",
      "label": "badgings store (timeclock module)",
      "path": "apps/vue-app/src/shared/store/modules/timeclock/badgings.js",
      "description": "All tab API calls: day_badgings + history reads, shifts (badging=true), matched_badgings/bulk_update saves, weekly-options validation — plus svc-punch settings via punch_client. Dedupes badgings by in_uuid ('Will not be useful when svc punch fully in production' — mid-migration marker)"
    },
    {
      "id": "cu-br-front-utils",
      "service": "skello-app-front",
      "kind": "service",
      "label": "day-window / overnight bucketing helpers",
      "path": "apps/vue-app/src/badgings/shared/utils/index.js",
      "description": "Client-side mirror of the backend day attribution: badgingDayWindow from the shop's openingTime/closingTime with a 30-min pre-opening buffer, midnight-shop special cases (Sunday→Monday buffer rule mirroring Shift#badging_date_at_opening), and modular midnight-crossing overlap math (isShiftInBadgingRange)"
    },
    {
      "id": "cu-br-front-punchclient",
      "service": "skello-app-front",
      "kind": "client",
      "label": "punch web client (punch_client.js)",
      "path": "apps/vue-app/src/shared/utils/clients/punch_client.js",
      "description": "FactoryPunchWeb bound to VUE_APP_SVC_PUNCH_API_URL — settings get/update and punch users, the front's only direct svc-punch surface"
    },
    {
      "id": "cu-br-badging-model",
      "service": "skello-app",
      "kind": "model-callback",
      "label": "Badging day attribution + matching windows",
      "path": "app/models/badging.rb",
      "description": "day_index buckets a badging into the shop-day whose opening-hour window contains it (badge before opening → previous day; ALLOWED_BADGING_TIME_BEFORE = 30min; Sun→Mon buffer case). SHIFT_MATCHING_TIME_WINDOW = 1.5h — reduced from 2h ('fix: badges on late sunday applied on next monday'). belongs_to :shift optional — shift_id is the match pointer, nullified when a shift is reassigned or changes opening-window day"
    },
    {
      "id": "cu-br-shift-model",
      "service": "skello-app",
      "kind": "model-callback",
      "label": "Shift day-at-opening methods",
      "path": "app/models/shift.rb",
      "description": "date_at_opening/badging_date_at_opening bucket shifts by the shop's opening hour (previsional_start preferred for review); displayed_on_previous_day_on_planning? is the direct overnight-shop check (opening.hour > closing.hour && starts_at.hour < opening.hour); has_one :badging dependent: :nullify"
    },
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
      "description": "The reconciliation core, under pg_advisory_xact_lock(shop, day): a badging already carrying shift_id UPDATES the planned Shift IN PLACE (badging-derived starts/ends; the plan survives in previsional_* columns; previsional_saved marks validation) — there is no parallel worked-shift row. Unmatched badgings create new Shift rows (idempotency guard reuses identical existing shifts). handle_day_differences resolves manager-edited hours to the right calendar day via ±12h against the badging date, and compute_ends_at rolls +1 day whenever ends <= starts (the 22:00→02:00 overnight build). svc-punch history writes flush AFTER the transaction commits"
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
      "from": "cu-br-front-page",
      "to": "cu-br-front-store",
      "label": "initialize day data (weekly options, teams, users, badgings)",
      "mode": "sync"
    },
    {
      "from": "cu-br-front-store",
      "to": "cu-br-front-utils",
      "label": "bucket badgings/shifts into review days (overnight-aware)",
      "mode": "sync"
    },
    {
      "from": "cu-br-front-store",
      "to": "cu-br-front-punchclient",
      "label": "punch settings read/edit",
      "mode": "sync"
    },
    {
      "from": "cu-br-front-punchclient",
      "to": "svc-punch",
      "label": "getSetting / partialUpdateSetting / getUsers (direct)",
      "mode": "sync"
    },
    {
      "from": "cu-br-front-store",
      "to": "skello-app",
      "label": "day_badgings + history reads, bulk_update saves",
      "mode": "sync"
    },
    {
      "from": "skello-app",
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
      "from": "cu-br-read-surface",
      "to": "cu-br-badging-model",
      "label": "match shifts ↔ badgings (1.5h window)",
      "mode": "sync"
    },
    {
      "from": "skello-app",
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
      "label": "reconcile badgings → shifts (pg advisory lock per shop+day)",
      "mode": "sync"
    },
    {
      "from": "cu-br-update-service",
      "to": "cu-br-badging-model",
      "label": "day attribution (opening-hour windows)",
      "mode": "sync"
    },
    {
      "from": "cu-br-update-service",
      "to": "cu-br-shift-model",
      "label": "in-place shift update — plan survives in previsional_*",
      "mode": "sync",
      "crud": ["update"]
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
