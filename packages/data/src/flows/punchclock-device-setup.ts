import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Mobile-apps arc, traced 2026-07-18 (skello-punchclock repo + auth route
// verification in the monolith). The tablet's identity chain is the part of
// the punch domain nobody had written down: three token tiers before the
// first punch is possible.
const punchclock_device_setup: ServiceFlow = ServiceFlowSchema.parse({
  "id": "punchclock-device-setup",
  "name": "Punch Clock Device Setup & Admin Area",
  "description": "A manager turns a tablet into the shop's punch clock. Three-tier auth chain: (1) manager signs in with email/password or SSO — POST /v3/login terminates in the MONOLITH behind the auth.skello.io host, SSO capability checks hit svc-users; (2) multi-org accounts pick an organisation (GET /v3/api/me/organisations) and swap to an employee-scoped token (svc-users POST /token-employee, requires canEditPunchClockSettings); (3) shop selection issues the device's long-lived identity — a shop-scoped time-clock JWT (POST /v3/login/login_time_clock, refreshed via refresh_time_clock_token, stored in expo-secure-store with AFTER_FIRST_UNLOCK; the stale token is deliberately reusable offline). First sync pulls punch settings and the employee list (with PINs) from svc-punch into on-device SQLite. The ADMIN AREA on the device (settings edit, day review of the shop's clock-in-outs, manual sync) sits behind a shop PIN read from svc-punch settings (shopPin). Feature flags (unauthenticated) gate the SQLite offline stacks and onboarding. Employees never authenticate: they punch with a 4-digit PIN matched locally (employee-clock-in flow).",
  "trigger": {"actor": "manager", "role": "punch settings (canEditPunchClockSettings)"},
  "links": [{"to": "employee-clock-in", "kind": "continuation", "note": "device identity provisioned here is what every subsequent punch authenticates with"}],
  "steps": [
    {
      "from": "skello-punchclock",
      "to": "skello-app",
      "action": "Manager login + device identity (POST /v3/login, /v3/login/login_time_clock, refresh_time_clock_token — auth.skello.io host; GET /v3/api/me/organisations)"
    },
    {
      "from": "skello-punchclock",
      "to": "svc-users",
      "action": "SSO capability check (login-capability) + multi-org employee-token swap (POST /token-employee)"
    },
    {
      "from": "skello-punchclock",
      "to": "svc-punch",
      "action": "First sync — settings (incl. shopPin) + employee list with PINs into SQLite; admin-area settings edits (PATCH /settings/{shopId})"
    },
    {
      "from": "skello-punchclock",
      "to": "svc-feature-flags",
      "action": "Unauthenticated GET /features — gates SQLite stacks, onboarding, debug dump"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-pds-signin",
      "service": "skello-punchclock",
      "kind": "component",
      "label": "SignIn screen",
      "path": "src/screens/SignIn/SignIn.tsx",
      "description": "Email/password via the auth client; SSO path via expo-sso-lib fed by svc-users pre-authentication repositories"
    },
    {
      "id": "cu-pds-orgsel",
      "service": "skello-punchclock",
      "kind": "component",
      "label": "organisation selector (token-employee swap)",
      "path": "src/screens/SignIn/OrganisationSelector.tsx",
      "description": "Lists organisations from the monolith (me/organisations) and swaps to an employee-scoped svc-users token — gated on canEditPunchClockSettings"
    },
    {
      "id": "cu-pds-auth",
      "service": "skello-punchclock",
      "kind": "client",
      "label": "auth client plugin (shop token lifecycle)",
      "path": "src/plugins/clients/AuthClient/AuthClient.ts",
      "description": "loginUser → loginShop (shop-scoped time-clock JWT) → single-flight refresh; secure-store keys for user/shop/refresh tokens; getShopAuthToken(allowOfflineToken) hands back the stale token when offline"
    },
    {
      "id": "cu-pds-loader",
      "service": "skello-punchclock",
      "kind": "component",
      "label": "AppLoader (boot sequence)",
      "path": "src/screens/AppLoader/AppLoader.tsx",
      "description": "SQLite migrations → feature flags → settings from SQLite → shop token restore → navigator choice (offline-first Clock stack vs online-only stack when settings.online)"
    },
    {
      "id": "cu-pds-shoppin",
      "service": "skello-punchclock",
      "kind": "component",
      "label": "ShopPin gate (admin area)",
      "path": "src/screens/ShopPin/ShopPin.tsx",
      "description": "Shop PIN from svc-punch settings (shopPin) guards settings edits, the day review and manual sync"
    },
    {
      "id": "cu-pds-review",
      "service": "skello-punchclock",
      "kind": "component",
      "label": "ShopClockInOuts day view",
      "path": "src/screens/ShopClockInOuts/ShopClockInOuts.tsx",
      "description": "Admin day review — device-local midnight-to-midnight window on the clock-IN timestamp (GET /clocks-in-out/shop/{shopId} or SQLite range), manual sync button. API results are shown from component state, never written back to SQLite"
    }
  ],
  "codeEdges": [
    {
      "from": "cu-pds-signin",
      "to": "cu-pds-auth",
      "label": "login (email/SSO)",
      "mode": "sync"
    },
    {
      "from": "cu-pds-signin",
      "to": "cu-pds-orgsel",
      "label": "multi-org → pick organisation",
      "mode": "sync"
    },
    {
      "from": "cu-pds-signin",
      "to": "svc-users",
      "label": "SSO login-capability",
      "mode": "sync"
    },
    {
      "from": "cu-pds-orgsel",
      "to": "skello-app",
      "label": "GET /v3/api/me/organisations",
      "mode": "sync"
    },
    {
      "from": "cu-pds-orgsel",
      "to": "svc-users",
      "label": "POST /token-employee",
      "mode": "sync",
      "auth": { "tokenType": "jwt", "gate": "canEditPunchClockSettings" }
    },
    {
      "from": "cu-pds-auth",
      "to": "skello-app",
      "label": "/v3/login + login_time_clock + refresh_time_clock_token",
      "mode": "sync",
      "auth": { "tokenType": "jwt" }
    },
    {
      "from": "cu-pds-loader",
      "to": "cu-pds-auth",
      "label": "restore shop token at boot",
      "mode": "sync"
    },
    {
      "from": "cu-pds-loader",
      "to": "svc-feature-flags",
      "label": "GET /features (unauthenticated)",
      "mode": "sync"
    },
    {
      "from": "cu-pds-shoppin",
      "to": "svc-punch",
      "label": "settings read (shopPin) + admin edits",
      "mode": "sync"
    },
    {
      "from": "cu-pds-review",
      "to": "svc-punch",
      "label": "GET /clocks-in-out/shop/{shopId} (day window on clock-IN)",
      "mode": "sync"
    }
  ],
  "infraNodes": [
    {
      "id": "sqlite-tablet-setup",
      "type": "sqlite",
      "label": "on-device SQLite (USERS, CONFIG, settings)",
      "description": "Settings + employee list (with PINs) replicated at sync time — what makes offline punching possible"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-punchclock",
      "to": "sqlite-tablet-setup",
      "label": "settings + users replication",
      "crud": ["create", "update"]
    }
  ]
})

export default punchclock_device_setup
