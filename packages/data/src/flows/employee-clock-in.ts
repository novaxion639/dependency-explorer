import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// REWRITTEN 2026-07-18 (mobile-apps arc): the original 2026-06-15 trace
// described the punch_clock/v1 raw-punch pipeline (BadgingsController →
// BadgingParserJob → BadgingParser → fake-badging mirror). That pipeline is
// DEAD in deployed code: routes deleted 2025-08-05 ('fix: Disabled legacy
// punch clock routes', double-gated by FEATUREDEV_ALLOW_TABLET_LEGACY) and
// CloseOldBadgingsJob's hourly cron is commented out of sidekiq.rb ('cause
// large lock problem'). The current tablet writes paired documents straight
// into svc-punch, offline-first.
const employee_clock_in: ServiceFlow = ServiceFlowSchema.parse({
  "id": "employee-clock-in",
  "name": "Employee Clock-In (Punch Clock Tablet)",
  "description": "An employee badges on the shop's tablet (SkelloPunchClock): types a 4-digit PIN matched against svc-punch's replicated user data, and the app upserts ONE paired ClockInOut document (in/out/pauses, badgedFrom: tablet_app, client-generated inUuid) DIRECTLY into svc-punch — a clock-out UPDATES the same record. Writes are offline-first: the SQLite row lands before the network call (sentToAPI=false → true), and the unsent queue drains in chunks of 25 on a 15-minute foreground timer, on connectivity regain and on screen focus — retrying forever except on 409/422 (the BR-15241/BR-15224 missing-punch fixes). svc-punch precomputes outAuto (auto-close = shop closing hour in the shop tz, +1 day for overnight shops — closedByBackend is DERIVED, no cron); the tablet's last-badging lookup prefers an OPEN badging over the newest record so a backend-auto-closed row can't block an overnight clock-out — a guard present in the offline path but ABSENT from the online-only path. The tablet never sees shifts: badging↔shift matching is entirely monolith-side at review time. The monolith's legacy punch_clock/v1 raw-punch pipeline (BadgingParser) is DEAD — routes deleted 2025-08-05; monolith Badging rows now materialize at badging-review validation. Each sync bumps lastTabletSync on the shop's SETTING row, which triggers the lateness callback into the monolith (see mobile-clock-in for that leg's code layer).",
  "trigger": {"actor": "employee", "role": "shop tablet PIN"},
  "steps": [
    {
      "from": "skello-punchclock",
      "to": "svc-punch",
      "action": "Upsert paired ClockInOut (POST clocks-in-out — offline-first queue) + sync settings, users & PINs",
      "ruleRefs": ["rule-overnight-day-attribution", "rule-clockin-shift-coupling"]
    },
    {
      "from": "svc-punch",
      "to": "skello-app",
      "action": "Lateness callback — SETTING stream (lastTabletSync) → POST /private/punch/trigger_lateness_sms_job"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-eci-pinscreen",
      "service": "skello-punchclock",
      "kind": "component",
      "label": "ClockPin screen (PIN gate)",
      "path": "src/screens/ClockPin/ClockPin.tsx",
      "description": "Reached from the Clock screen's Start/Finish buttons; useClockPin matches the 4-digit PIN against svc-punch user data, fetches the last clock-in-out (rolling 24h window, PREFERRING an open badging over the newest record — the BR-15241 overnight guard), validates the transition and builds the upsert payload",
      "ruleRefs": ["rule-overnight-day-attribution", "rule-clockin-shift-coupling"]
    },
    {
      "id": "cu-eci-card",
      "service": "skello-punchclock",
      "kind": "component",
      "label": "UserClockInOutModal — ClockInOutCard",
      "path": "src/screens/ClockPin/UserClockInOutModal/ClockInOutCard.tsx",
      "description": "Confirmation card inside the user clock-in-out modal — submits the punch to the SQLite-first upsert hook"
    },
    {
      "id": "cu-eci-upsert",
      "service": "skello-punchclock",
      "kind": "service",
      "label": "useSQLiteUpsertClockInOuts",
      "path": "src/modules/clockInOuts/hooks/useSQLiteUpsertClockInOuts.ts",
      "description": "SQLite write FIRST (sentToAPI=false), then best-effort POST to svc-punch; on success re-upserts with sentToAPI=true keeping the same inUuid. Network failure at punch time is non-fatal — the row stays queued"
    },
    {
      "id": "cu-eci-sync",
      "service": "skello-punchclock",
      "kind": "service",
      "label": "syncAppdata (config hooks)",
      "path": "src/modules/config/hooks/hooks.ts",
      "description": "15-minute foreground timer (no OS background task despite the UIBackgroundModes manifest), connectivity-regain and screen-focus triggers: refreshes settings + users into SQLite and drains the unsent punch queue. API-fetched badgings are never pulled back into SQLite — offline, a backend auto-close is invisible to the device"
    },
    {
      "id": "cu-eci-queue",
      "service": "skello-punchclock",
      "kind": "service",
      "label": "queue drain (useSQLiteSyncClockInOuts)",
      "path": "src/modules/clockInOuts/hooks/useSQLiteSyncClockInOuts.ts",
      "description": "SELECT … WHERE sentToAPI = 0, chunks of 25, Promise.allSettled; only 409/422 are dropped permanently — everything else retries forever"
    },
    {
      "id": "cu-eci-controller",
      "service": "svc-punch",
      "kind": "controller",
      "label": "ClocksInOutController",
      "path": "src/Controller/ClocksInOutController.ts",
      "description": "clocks-in-out CRUD surface — in-lambda auth accepts the shop-scoped time-clock JWT (canWriteClockInOuts) or the monolith API key"
    },
    {
      "id": "cu-eci-manager",
      "service": "svc-punch",
      "kind": "manager",
      "label": "ClockInOutManager",
      "path": "src/Manager/ClockInOutManager.ts",
      "description": "calculateOutAuto precomputes the auto-close timestamp at write time (getShopClosingTime: shop closing hour in the shop tz, +1 day when already past it — the overnight case); closedByBackend = out === outAuto, no cron. Repository sweeps duplicate rows sharing an id after key-changing updates",
      "ruleRefs": ["rule-overnight-day-attribution", "rule-clockin-shift-coupling"]
    }
  ],
  "codeEdges": [
    {
      "from": "cu-eci-pinscreen",
      "to": "cu-eci-card",
      "label": "PIN ok → confirm punch",
      "mode": "sync"
    },
    {
      "from": "cu-eci-card",
      "to": "cu-eci-upsert",
      "label": "doUpsertClockInOut",
      "mode": "sync"
    },
    {
      "from": "cu-eci-upsert",
      "to": "sqlite-tablet",
      "label": "row first (sentToAPI=false), flip on API success",
      "mode": "sync",
      "crud": ["create", "update"]
    },
    {
      "from": "cu-eci-upsert",
      "to": "svc-punch",
      "label": "best-effort POST clocks-in-out",
      "mode": "sync",
      "auth": { "tokenType": "jwt", "authAbsent": "no-authorizer-configured" }
    },
    {
      "from": "cu-eci-sync",
      "to": "cu-eci-queue",
      "label": "drain unsent queue (15-min timer / reconnect / focus)",
      "mode": "sync"
    },
    {
      "from": "cu-eci-queue",
      "to": "svc-punch",
      "label": "replay queued punches (chunks of 25)",
      "mode": "sync"
    },
    {
      "from": "svc-punch",
      "to": "cu-eci-controller",
      "label": "clocks-in-out routes",
      "mode": "sync"
    },
    {
      "from": "cu-eci-controller",
      "to": "cu-eci-manager",
      "label": "create/update (same-second dedup on retry)",
      "mode": "sync"
    },
    {
      "from": "cu-eci-manager",
      "to": "dynamo-svc-punch-tablet",
      "label": "ClockInOut item — shop/user/timestamps only, no shift reference",
      "mode": "sync",
      "crud": ["create", "update"]
    }
  ],
  "infraNodes": [
    {
      "id": "sqlite-tablet",
      "type": "sqlite",
      "label": "on-device SQLite (CLOCK_IN_OUTS, USERS, CONFIG)",
      "description": "Offline-first store — serialized writes, 2-month retention; compliance photos/signatures stay in local files (no upload endpoint exists)"
    },
    {
      "id": "dynamo-svc-punch-tablet",
      "type": "dynamodb",
      "label": "svcPunch-{env}",
      "description": "Single-table store (CLOCKINOUT/SETTING/HISTORY + replicated users). The SETTING stream feeds the lateness callback and mobile-permission recalculation"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-punch",
      "to": "dynamo-svc-punch-tablet",
      "label": "clock-in-out writes",
      "crud": ["create", "update"]
    }
  ]
})

export default employee_clock_in
