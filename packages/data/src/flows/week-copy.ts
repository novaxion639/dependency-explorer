import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Code layer traced 2026-06-12 (shifts_controller#duplicate_from_previous_week_or_day
// → duplicate_from_previous_week_or_day_service.rb → planning_duplicator.rb).
// Distinctive semantics: a sync/async week split to dodge client timeouts.
// The previously documented svc-shifts metrics call, bulk-copied event, comms
// email and DLQ had NO code path and were removed.
const week_copy: ServiceFlow = ServiceFlowSchema.parse({
  "id": "week-copy",
  "name": "Week Copy",
  "description": "A manager copies shifts from a previous week (or day) into target weeks. Timeout-dodging split: the FIRST 5 weeks are duplicated synchronously in the request; any remaining weeks are re-enqueued as one Sidekiq job per week running the same service. Each copied shift is a real Shift.create — the creation callback group (cache, staleness, paid leaves, predicted shifts) fires per shift. A FeatureClick row records the product usage. (Corrected 2026-06-12: no svc-shifts call, no event emission, no notification, no DLQ exist in this path.)",
  "trigger": {"actor": "manager", "role": "planner"},
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST /v3/shifts — duplicate_from_previous_week_or_day (weeks_checked[])"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-wc-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::Plannings::ShiftsController#duplicate_from_previous_week_or_day",
      "path": "app/controllers/v3/api/plannings/shifts_controller.rb",
      "description": "Splits weeks_checked: first 5 weeks run synchronously, the rest are enqueued one job per week to avoid client timeouts"
    },
    {
      "id": "cu-wc-service",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::Shifts::DuplicateFromPreviousWeekOrDayService",
      "path": "app/services/v3/shifts/duplicate_from_previous_week_or_day_service.rb",
      "description": "Runs the PlanningDuplicator per target week, recomputes counters, records a FeatureClick usage row"
    },
    {
      "id": "cu-wc-async-job",
      "service": "skello-app",
      "kind": "job",
      "label": "DuplicateFromPreviousWeekJob",
      "path": "app/jobs/duplicate_from_previous_week_job.rb",
      "description": "Sidekiq — one job per overflow week (week 6+), running the same duplication service out-of-request"
    },
    {
      "id": "cu-wc-duplicator",
      "service": "skello-app",
      "kind": "service",
      "label": "PlanningDuplicator",
      "path": "app/services/planning_duplicator.rb",
      "description": "The core copier: clones the source week's shifts into the target week (Shift.create per shift — the creation callback group fires for every copied shift)"
    },
    {
      "id": "cu-wc-tracker",
      "service": "skello-app",
      "kind": "manager",
      "label": "V3::CombinedTrackerUpdateService",
      "path": "app/services/v3/combined_tracker_update_service.rb",
      "description": "Counter recompute for every user receiving copied shifts"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-wc-controller",
      "label": "POST duplicate_from_previous_week_or_day",
      "mode": "sync"
    },
    {
      "from": "cu-wc-controller",
      "to": "cu-wc-service",
      "label": "first 5 weeks — synchronous",
      "mode": "sync"
    },
    {
      "from": "cu-wc-controller",
      "to": "cu-wc-async-job",
      "label": "one job per overflow week",
      "mode": "async-job",
      "condition": "more than 5 weeks selected"
    },
    {
      "from": "cu-wc-async-job",
      "to": "cu-wc-service",
      "label": "same service, out-of-request",
      "mode": "sync"
    },
    {
      "from": "cu-wc-service",
      "to": "cu-wc-duplicator",
      "label": "clone week",
      "mode": "sync"
    },
    {
      "from": "cu-wc-duplicator",
      "to": "pg-skello-week-copy",
      "label": "Shift.create ×N (creation callbacks fire per shift)",
      "mode": "sync",
      "crud": ["create"]
    },
    {
      "from": "cu-wc-service",
      "to": "cu-wc-tracker",
      "label": "recompute counters",
      "mode": "sync"
    },
    {
      "from": "cu-wc-tracker",
      "to": "pg-skello-week-copy",
      "label": "counters + FeatureClick usage row",
      "mode": "sync",
      "crud": ["update", "create"]
    },
    {
      "from": "pg-skello-week-copy",
      "to": "svc-search",
      "label": "DMS CDC → raw_shifts replica (bulk rows)",
      "mode": "async-event"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-week-copy",
      "type": "postgresql",
      "label": "skello_production — shifts, counters, feature_clicks",
      "description": "Bulk shift rows for each target week + counter tables + product-usage tracking"
    },
    {
      "id": "redis-skello-week-copy",
      "type": "redis",
      "label": "skello-redis",
      "description": "Sidekiq broker for the per-week overflow jobs and the per-shift creation callback jobs"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-skello-week-copy",
      "label": "bulk create shifts",
      "crud": ["create"]
    },
    {
      "from": "skello-app",
      "to": "redis-skello-week-copy",
      "label": "enqueue overflow weeks"
    }
  ]
})

export default week_copy
