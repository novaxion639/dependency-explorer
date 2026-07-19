import { DomainRuleSchema } from '@dependency-explorer/schema'
import type { DomainRule } from '@dependency-explorer/schema'
import { z } from 'zod'

// Domain rules — cross-flow business knowledge lifted out of flow prose into
// first-class, referenceable cards (Flow Expressiveness M1, docs/spec.md §1).
// Statements are human-owned meaning, authored from code reading during the
// 2026-07-18 mobile-apps arc (PR #7 traces). Machine-checked around them:
// integrity tests verify every ruleRef/codeUnitRef resolves and no rule is
// orphaned; the discovery scanner verifies every sourcePath exists (📐).
const rules: DomainRule[] = z.array(DomainRuleSchema).parse([
  {
    id: 'rule-overnight-day-attribution',
    title: 'Overnight day attribution',
    statement:
      'Which shop-day a badging or shift belongs to is computed from the shop\'s opening/closing hours — no overnight flag exists anywhere (over_midnight? = opening.hour >= closing.hour). A punch before opening time belongs to the PREVIOUS shop-day, with a 30-minute pre-opening buffer (ALLOWED_BADGING_TIME_BEFORE) and a Sunday→Monday week-boundary special case. Badging↔shift matching uses a 1.5h window (SHIFT_MATCHING_TIME_WINDOW — deliberately reduced from 2h so late-Sunday badges stop matching early-Monday shifts). At validation, ends_at rolls +1 day whenever ends <= starts (the 22:00→02:00 build) and manager-edited hours resolve to a calendar day via a ±12h heuristic. svc-punch precomputes the auto-close timestamp at write time (shop closing hour in the shop timezone, +1 day when already past it) — closedByBackend is derived, there is no cron.',
    sourceOfTruth: 'cu-br-badging-model',
    divergences: [
      {
        platform: 'backend',
        behavior:
          'svc-punch computes outAuto at write time (getShopClosingTime: closing hour in the shop tz, +1 day past closing) and buckets pre-opening punches into the previous shop-day; closedByBackend = out === outAuto, derived — no auto-close cron exists',
        codeUnitRef: 'cu-eci-manager',
      },
      {
        platform: 'monolith',
        behavior:
          'Badging#day_index opening-hour windows + 30-min pre-opening buffer + Sun→Mon case; Shift#badging_date_at_opening (previsional_start preferred); DayUpdateService resolves days ±12h and rolls ends_at +1 day when ends <= starts',
        codeUnitRef: 'cu-br-badging-model',
      },
      {
        platform: 'web',
        behavior:
          'Client-side REIMPLEMENTATION of the monolith attribution (badgingDayWindow, 30-min buffer, midnight-shop Sunday rule, modular midnight-crossing overlap math) — a duplicated-logic drift risk, not a deliberate behavioral difference',
        codeUnitRef: 'cu-br-front-utils',
      },
      {
        platform: 'tablet',
        behavior:
          'Groups records by device-local midnight of the clock-IN day (not shop hours); the last-badging lookup is a rolling 24h window PREFERRING an open badging over the newest record (BR-15241) — a guard present in the offline path but ABSENT from the online-only path, and API badgings are never pulled back into SQLite, so a backend auto-close is invisible offline',
        codeUnitRef: 'cu-eci-pinscreen',
      },
    ],
    sourcePaths: [
      'svc-punch/src/Manager/ClockInOutManager.ts',
      'skello-app/app/models/badging.rb',
      'skello-app/app/models/shift.rb',
      'skello-app/app/services/v3/matched_badgings/day_update_service.rb',
      'skello-app-front/apps/vue-app/src/badgings/shared/utils/index.js',
      'skello-punchclock/src/screens/ClockPin/ClockPin.tsx',
    ],
    // Stamped 2026-07-19 — on drift, re-read the file, update the statement if
    // needed, and re-stamp with the sha256 the 📐 finding prints.
    sourceHashes: [
      { path: 'svc-punch/src/Manager/ClockInOutManager.ts', sha256: '06054133caf7bd9900e533131fa74642789a5a53562ac97210d750dd57073ba6' },
      { path: 'skello-app/app/models/badging.rb', sha256: '74062510dc7e4ec747bcaf3db2702991ae6c2a9ad3714fbaa2814a3154c4feef' },
      { path: 'skello-app/app/models/shift.rb', sha256: '27eafcf1b194ab8e08d92b8d8b50659580aee48f745ed85c79e5bcc65f199aab' },
      { path: 'skello-app/app/services/v3/matched_badgings/day_update_service.rb', sha256: 'f2fc9a05b75a250178eaec147a5cfc07b9567f944ad780951c49d10a9cf7c5b7' },
      { path: 'skello-app-front/apps/vue-app/src/badgings/shared/utils/index.js', sha256: '310adacbfa25720bd6c17c5ca0428237f86a9722eff07dcbfa1f8e5f7beb8728' },
      { path: 'skello-punchclock/src/screens/ClockPin/ClockPin.tsx', sha256: 'bc753adbb129861f40ff2e4426515b14e1a46a7cb7f09056043c86818d308dbd' },
    ],
  },
  {
    id: 'rule-clockin-shift-coupling',
    title: 'Clock-in / shift coupling',
    statement:
      'ClockInOut documents in svc-punch carry shop, user and timestamps ONLY — no shift reference exists at punch time. Badging↔shift matching happens entirely monolith-side at review: Badging.shift_id is the match pointer (belongs_to :shift, optional), set within the 1.5h matching window and NULLIFIED when the shift is reassigned to another user or moves to a different opening-window day (V3::Shifts::UpdateService#remove_dependencies). Validating a day runs DayUpdateService under pg_advisory_xact_lock(shop, day): a matched badging updates the PLANNED Shift row IN PLACE with badging-derived times — the original plan survives only in previsional_* columns and previsional_saved marks validation; there is no parallel worked-shift row. Match results write back to svc-punch as HISTORY rows AFTER the transaction commits.',
    sourceOfTruth: 'cu-br-update-service',
    divergences: [
      {
        platform: 'backend',
        behavior:
          'svc-punch stores paired ClockInOut documents with no shiftId and never learns about planning; adjustment HISTORY rows written back from the monolith are its only view of the match',
        codeUnitRef: 'cu-eci-manager',
      },
      {
        platform: 'monolith',
        behavior:
          'Owns the entire coupling: 1.5h-window matching, shift_id pointer lifecycle (nullified on user/day change), in-place planned-shift update under the advisory lock, post-commit history flush',
        codeUnitRef: 'cu-br-update-service',
      },
      {
        platform: 'tablet',
        behavior:
          'Never sees shifts — punch validity is judged against the last badging only (open-badging preference, rolling 24h), so shift-level anomalies surface only at review time',
        codeUnitRef: 'cu-eci-pinscreen',
      },
    ],
    sourcePaths: [
      'svc-punch/src/Manager/ClockInOutManager.ts',
      'skello-app/app/models/badging.rb',
      'skello-app/app/services/v3/matched_badgings/day_update_service.rb',
      'skello-app/app/services/v3/shifts/update_service.rb',
    ],
    sourceHashes: [
      { path: 'svc-punch/src/Manager/ClockInOutManager.ts', sha256: '06054133caf7bd9900e533131fa74642789a5a53562ac97210d750dd57073ba6' },
      { path: 'skello-app/app/models/badging.rb', sha256: '74062510dc7e4ec747bcaf3db2702991ae6c2a9ad3714fbaa2814a3154c4feef' },
      { path: 'skello-app/app/services/v3/matched_badgings/day_update_service.rb', sha256: 'f2fc9a05b75a250178eaec147a5cfc07b9567f944ad780951c49d10a9cf7c5b7' },
      { path: 'skello-app/app/services/v3/shifts/update_service.rb', sha256: 'c7851ca0013c27499f24be6e90b34469cd9808b9638ecbf504f1cb5b6d0778ba' },
    ],
  },
])

export default rules
