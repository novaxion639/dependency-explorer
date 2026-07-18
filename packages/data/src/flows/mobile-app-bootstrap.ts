import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Mobile-apps arc, traced 2026-07-18. The phone's launch path touches five
// backends before the Home screen renders — grouped into ordered phases like
// the web page-load flows.
const mobile_app_bootstrap: ServiceFlow = ServiceFlowSchema.parse({
  "id": "mobile-app-bootstrap",
  "name": "Mobile App Launch & Session",
  "description": "The skello-mobile launch path. Pre-auth: mobile config (GET /v3/api/mobile/config — an UNAUTHENTICATED monolith endpoint driving version gates) and feature flags (unauthenticated svc-feature-flags GET /features). Sign-in: email/password hits POST /v3/login on the MONOLITH (auth.skello.io host) with includedAuthorizations [punchClock]; SSO runs through svc-users pre-authentication capability checks; multi-org accounts swap to an employee-scoped token (svc-users POST /token-employee). Tokens are chunked into expo-secure-store (2000-byte chunks beating the 2048 SecureStore limit) with single-flight refresh; INVALID_TOKEN forces logout. Session bootstrap then pulls current_user, memberships and holiday settings from the monolith, and the main tab navigator registers the Expo push token as a device token on svc-communications-v2 (with retry). Home banners come from the mobile-only v3/api/mobile/banners surface.",
  "steps": [
    {
      "from": "skello-mobile",
      "to": "svc-feature-flags",
      "action": "Pre-auth feature flags (unauthenticated GET /features)",
      "phase": "1 · Pre-auth"
    },
    {
      "from": "skello-mobile",
      "to": "skello-app",
      "action": "Mobile config version gate (GET /v3/api/mobile/config, unauthenticated) — then login (/v3/login) and session bootstrap (current_user, memberships, banners)",
      "phase": "1 · Pre-auth"
    },
    {
      "from": "skello-mobile",
      "to": "svc-users",
      "action": "SSO capability (login-capability) + multi-org token swap (POST /token-employee)",
      "phase": "2 · Sign-in"
    },
    {
      "from": "skello-mobile",
      "to": "svc-communications-v2",
      "action": "Register the Expo push token as a device token (upsert on tab mount, delete on logout)",
      "phase": "3 · Session"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-mab-config",
      "service": "skello-mobile",
      "kind": "service",
      "label": "mobile config api (version gate)",
      "path": "src/modules/config/api.ts",
      "description": "GET /v3/api/mobile/config — unauthenticated; drives forced-update alerts"
    },
    {
      "id": "cu-mab-flags",
      "service": "skello-mobile",
      "kind": "service",
      "label": "feature flags api (pre-auth)",
      "path": "src/modules/featureFlags/api.ts",
      "description": "Unauthenticated GET /features on svc-feature-flags at startup"
    },
    {
      "id": "cu-mab-signin",
      "service": "skello-mobile",
      "kind": "component",
      "label": "SignIn screen",
      "path": "src/screens/SignIn/SignIn.tsx",
      "description": "Email/password login with includedAuthorizations [punchClock]; SSO via expo-sso-lib fed by svc-users repositories; multi-org → organisation selector"
    },
    {
      "id": "cu-mab-auth",
      "service": "skello-mobile",
      "kind": "client",
      "label": "auth client plugin (chunked secure store)",
      "path": "src/plugins/clients/AuthClient/AuthClient.ts",
      "description": "Tokens chunked at 2000 bytes into expo-secure-store; single-flight refresh; INVALID_TOKEN → logout. Every SDK client reuses its request/response interceptors"
    },
    {
      "id": "cu-mab-orgswitch",
      "service": "skello-mobile",
      "kind": "service",
      "label": "org switch context (token-employee)",
      "path": "src/context/orgSwitchContext.tsx",
      "description": "Organisation switch swaps to an employee-scoped svc-users token"
    },
    {
      "id": "cu-mab-bootstrap",
      "service": "skello-mobile",
      "kind": "service",
      "label": "current-user bootstrap (useInitializeCurrentUser)",
      "path": "src/modules/currentUser/hooks.ts",
      "description": "Post-login: current_user, memberships, holiday settings from the monolith — seeds the Redux session"
    },
    {
      "id": "cu-mab-push",
      "service": "skello-mobile",
      "kind": "service",
      "label": "push registration (skPushNotifications)",
      "path": "src/plugins/skPushNotifications/skPushNotifications.ts",
      "description": "Expo push token (with retry) → device-token upsert on svc-communications-v2; mounted from the main tab navigator"
    }
  ],
  "codeEdges": [
    {
      "from": "cu-mab-flags",
      "to": "svc-feature-flags",
      "label": "GET /features",
      "mode": "sync"
    },
    {
      "from": "cu-mab-config",
      "to": "skello-app",
      "label": "GET /v3/api/mobile/config (unauthenticated)",
      "mode": "sync"
    },
    {
      "from": "cu-mab-signin",
      "to": "cu-mab-auth",
      "label": "login / setAuthToken (SSO)",
      "mode": "sync"
    },
    {
      "from": "cu-mab-signin",
      "to": "svc-users",
      "label": "SSO login-capability",
      "mode": "sync"
    },
    {
      "from": "cu-mab-auth",
      "to": "skello-app",
      "label": "POST /v3/login (auth.skello.io) + refresh",
      "mode": "sync"
    },
    {
      "from": "cu-mab-orgswitch",
      "to": "svc-users",
      "label": "POST /token-employee",
      "mode": "sync"
    },
    {
      "from": "cu-mab-signin",
      "to": "cu-mab-bootstrap",
      "label": "initialize current user",
      "mode": "sync"
    },
    {
      "from": "cu-mab-bootstrap",
      "to": "skello-app",
      "label": "current_user + memberships + holiday settings",
      "mode": "sync"
    },
    {
      "from": "cu-mab-push",
      "to": "svc-communications-v2",
      "label": "device-token upsert (Expo push token)",
      "mode": "sync"
    }
  ]
})

export default mobile_app_bootstrap
