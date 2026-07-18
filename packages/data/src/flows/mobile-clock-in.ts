import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Mobile-apps arc, traced 2026-07-18 on both sides (skello-mobile +
// svc-punch + monolith). The phone punches DIRECTLY into svc-punch — the
// monolith has NO mobile clock-in controller (verified: v3/api/mobile only
// serves config/banners; the only badging write in v3/api is the review
// bulk_update). The lateness leg closes the loop through the sixth
// service→monolith callback.
const mobile_clock_in: ServiceFlow = ServiceFlowSchema.parse({
  "id": "mobile-clock-in",
  "name": "Mobile Clock-In (Employee Phone)",
  "description": "An employee clocks in from the Skello mobile app. The phone calls svc-punch DIRECTLY (clocks-in-out, badgedFrom: mobile_app) — the monolith is not in the request path. GPS capture is best-effort and NEVER blocks the punch (BR-15285); a client-generated inUuid plus svc-punch's same-second dedup guard make retries idempotent. svc-punch precomputes the auto-close timestamp at write time (calculateOutAuto = shop closing time in the shop's timezone, rolled +1 day for overnight shops) — there is NO auto-close cron anywhere; 'closedByBackend' is derived as out === outAuto. Clock-out and pauses PATCH the same record from the in-progress screen. Mobile punching is gated per-user (settings.mobileClocksInOutActivatedUsers, maintained through the settings/mobile surface and recalculated via the SnsMobilePermissions topic when settings change). Each mobile badge also bumps lastMobileBadgeDate on the shop's SETTING row — svc-punch's own table stream picks that up and calls the monolith's lateness SMS job (the sixth service→monolith callback).",
  "steps": [
    {
      "from": "skello-mobile",
      "to": "svc-punch",
      "action": "Clock in/out/pause (POST clocks-in-out / PATCH clocks-in-out/{id} — badgedFrom: mobile_app, inUuid, best-effort GPS) + settings & permission reads"
    },
    {
      "from": "svc-punch",
      "to": "skello-app",
      "action": "Lateness callback — SETTING stream change (lastMobileBadgeDate) → POST /private/punch/trigger_lateness_sms_job (X-Api-Key)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-mci-screen",
      "service": "skello-mobile",
      "kind": "component",
      "label": "ClockInScreen / ClockInProgressScreen",
      "path": "src/screens/PunchClock/ClockInScreen/ClockInScreen.tsx",
      "description": "Clock-in: shift picker (incl. NO_SHIFT), shop picker, swipe slider → createClockInOut; GPS acquired best-effort and never blocking (BR-15285). ClockInProgressScreen clocks out ({ out: NOW }) and manages pauses as [in, out] pairs"
    },
    {
      "id": "cu-mci-api",
      "service": "skello-mobile",
      "kind": "service",
      "label": "punchClock api — ClockInOut calls",
      "path": "src/modules/punchClock/api.ts",
      "description": "createClockInOut / partialUpdateClockInOut wrapped in withDoubleCallReporting (double-tap telemetry); payload { in: NOW, userId, shopId, badgedFrom: mobile_app, inUuid (expo-crypto), locations }"
    },
    {
      "id": "cu-mci-client",
      "service": "skello-mobile",
      "kind": "client",
      "label": "punch client plugin (svc-punch-js mobile factory)",
      "path": "src/plugins/clients/PunchClient/PunchClient.ts",
      "description": "@skelloapp/svc-punch-js mobile factory bound to PUNCH_URL — svc-punch direct, monolith not involved"
    },
    {
      "id": "cu-mci-controller",
      "service": "svc-punch",
      "kind": "controller",
      "label": "ClocksInOutController",
      "path": "src/Controller/ClocksInOutController.ts",
      "description": "clocks-in-out CRUD surface (in-lambda auth: JWT time-clock token permissions or monolith API key)"
    },
    {
      "id": "cu-mci-manager",
      "service": "svc-punch",
      "kind": "manager",
      "label": "ClockInOutManager",
      "path": "src/Manager/ClockInOutManager.ts",
      "description": "Write path: calculateOutAuto precomputes the auto-close timestamp (getShopClosingTime — shop closing hour in the shop tz, +1 day when the clock-in is already past it: the overnight case). closedByBackend = out === outAuto, derived — no cron. Carries a @todo tolerating outAuto ± tz-offset because the monolith once sent wrong values"
    },
    {
      "id": "cu-mci-lateness",
      "service": "svc-punch",
      "kind": "job",
      "label": "TriggerLatenessSMSJobHandler",
      "path": "src/Handler/Jobs/TriggerLatenessSMSJobHandler.ts",
      "description": "DynamoDB-stream consumer on the service's own SETTING rows — fires when lastTabletSync/lastMobileBadgeDate moves"
    },
    {
      "id": "cu-mci-sac",
      "service": "svc-punch",
      "kind": "client",
      "label": "SkelloAppClient",
      "path": "src/Client/SkelloAppClient.ts",
      "description": "Monolith HTTP client (X-Api-Key + X-Source-Client: svcPunch) — postTriggerLatenessNotificationJob"
    },
    {
      "id": "cu-mci-private",
      "service": "skello-app",
      "kind": "controller",
      "label": "Private::PunchesController#trigger_lateness_sms_job",
      "path": "app/controllers/private/punches_controller.rb",
      "description": "Private callback surface — enqueues the lateness notification job for the shop"
    },
    {
      "id": "cu-mci-latejob",
      "service": "skello-app",
      "kind": "job",
      "label": "PunchClock::LatenessNotificationJob",
      "path": "app/jobs/punch_clock/lateness_notification_job.rb",
      "description": "Sidekiq — computes late employees vs planned shifts and notifies planners (SMS)"
    }
  ],
  "codeEdges": [
    {
      "from": "cu-mci-screen",
      "to": "cu-mci-api",
      "label": "create / update clock-in-out",
      "mode": "sync"
    },
    {
      "from": "cu-mci-api",
      "to": "cu-mci-client",
      "label": "punchClient calls",
      "mode": "sync"
    },
    {
      "from": "cu-mci-client",
      "to": "svc-punch",
      "label": "POST clocks-in-out / PATCH clocks-in-out/{id}",
      "mode": "sync"
    },
    {
      "from": "svc-punch",
      "to": "cu-mci-controller",
      "label": "clocks-in-out routes",
      "mode": "sync"
    },
    {
      "from": "cu-mci-controller",
      "to": "cu-mci-manager",
      "label": "create/partialUpdate (same-second dedup on retry)",
      "mode": "sync"
    },
    {
      "from": "cu-mci-manager",
      "to": "dynamo-svc-punch",
      "label": "ClockInOut item (PK ClockInOut#{shopId}#{userId}, SK in) — no shift reference",
      "mode": "sync",
      "crud": ["create", "update"]
    },
    {
      "from": "dynamo-svc-punch",
      "to": "cu-mci-lateness",
      "label": "SETTING stream (lastMobileBadgeDate moved)",
      "mode": "async-event"
    },
    {
      "from": "cu-mci-lateness",
      "to": "cu-mci-sac",
      "label": "trigger lateness job",
      "mode": "sync"
    },
    {
      "from": "cu-mci-sac",
      "to": "skello-app",
      "label": "POST /private/punch/trigger_lateness_sms_job",
      "mode": "sync"
    },
    {
      "from": "skello-app",
      "to": "cu-mci-private",
      "label": "private callback route",
      "mode": "sync"
    },
    {
      "from": "cu-mci-private",
      "to": "cu-mci-latejob",
      "label": "perform_async(shop_id)",
      "mode": "async-job"
    }
  ],
  "infraNodes": [
    {
      "id": "dynamo-svc-punch",
      "type": "dynamodb",
      "label": "svcPunch-{env}",
      "description": "Single-table store: CLOCKINOUT, SETTING, HISTORY, replicated USER rows. ClockInOut items reference shop/user/timestamps ONLY — shift matching happens entirely in the monolith"
    },
    {
      "id": "redis-skello-lateness",
      "type": "redis",
      "label": "skello-redis",
      "description": "Sidekiq broker for LatenessNotificationJob"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-punch",
      "to": "dynamo-svc-punch",
      "label": "clock-in-out writes",
      "crud": ["create", "update"]
    },
    {
      "from": "skello-app",
      "to": "redis-skello-lateness",
      "label": "enqueue lateness job"
    }
  ]
})

export default mobile_clock_in
