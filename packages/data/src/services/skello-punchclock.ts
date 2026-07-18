import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const skello_punchclock: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "skello-punchclock",
  "type": "react-native",
  "description": "SkelloPunchClock — the shop tablet ('La Badgeuse', React Native + Expo). Punch traffic goes DIRECT to svc-punch: one paired ClockInOut document per badging (in/out/pauses, badgedFrom: tablet_app, client-generated inUuid), upserted offline-first — SQLite write lands before the network call, the unsent queue (sentToAPI=0) drains in chunks of 25 and retries forever except on 409/422 (the BR-15241/BR-15224 missing-punch fixes). Three-tier auth: manager email/SSO login (/v3/login on the monolith behind auth.skello.io, token-employee on svc-users for multi-org) → shop-scoped time-clock JWT (login_time_clock) as the device identity → per-employee 4-digit PIN matched against svc-punch user data at punch time. The tablet NEVER fetches shifts — badging↔shift matching is entirely backend-side; day grouping on-device is local-calendar-midnight of the clock-IN. Compliance photos/signatures stay in local files only (no upload endpoint). The monolith's punch_clock/v1 device protocol is DEAD: routes deleted 2025-08-05 and double-gated by FEATUREDEV_ALLOW_TABLET_LEGACY. Traced 2026-07-18.",
  "endpoints": []
})

export default skello_punchclock
