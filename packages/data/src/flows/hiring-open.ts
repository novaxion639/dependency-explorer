import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

const hiring_open: ServiceFlow = ServiceFlowSchema.parse({
  "id": "hiring-open",
  "name": "Open Hiring (Join)",
  "description": "A manager clicks Hiring in the navbar. When the hiring_join shop feature is off the click opens the upsell modal instead. Otherwise the front reads from the monolith the caller's accessible active shops, keeps those with hiring_join, and gathers the users who can hire (every can_hire administrator for a system admin — the admin alone when licences are unreadable — the manager alone otherwise); it posts that setup snapshot to svc-hiring POST /join_token. svc-hiring checks the caller belongs to the organisation, mints a partner access key from the monolith on first setup, provisions the Join company, users and offices synchronously (DynamoDB status rows make every step idempotent), emails new accounts and errors through svc-communications-v2, then asks Join for an auto-login token. The front opens the returned redirectUrl in a new tab. Only a failure on the company or on the connecting user blocks the token; other users' and offices' failures are reported and retried on the next click.",
  "trigger": { "actor": "manager", "role": "can_hire license on a hiring_join shop" },
  "primaryArea": "hiring",
  "chapters": [
    { "title": "A manager clicks Hiring", "summary": "The navbar opens the upsell modal when Hiring is not enabled for the shop; otherwise it starts opening Join.", "refs": ["skello-app-front", "cu-ho-navbar", "cu-ho-open"] },
    { "title": "The front sends a setup snapshot", "summary": "It gathers the organisation, its hiring shops and the users who can hire, and posts them to svc-hiring for a Join token.", "refs": ["cu-ho-open", "cu-ho-api", "svc-hiring"] },
    { "title": "The caller is checked", "summary": "svc-hiring only serves a caller whose organisation matches the request.", "refs": ["svc-hiring", "cu-ho-controller"] },
    { "title": "Skello hands Join an access key", "summary": "On first setup svc-hiring mints an organisation access key from the monolith, which Join uses to call back into Skello.", "refs": ["cu-ho-token-mgr", "cu-ho-skello-client", "skello-app", "dynamo-svc-users-access-key"] },
    { "title": "Join accounts are provisioned", "summary": "The company, then each user and office, is created on Join once; DynamoDB status rows make every retry safe.", "refs": ["cu-ho-setup-mgr", "dynamo-svc-hiring", "cu-ho-join-client"] },
    { "title": "New accounts and errors are emailed", "summary": "Admins created on Join get an account-created email, other new users a welcome email; Join errors are emailed to every admin.", "refs": ["cu-ho-notifier", "svc-communications-v2"] },
    { "title": "Join opens in a new tab", "summary": "svc-hiring asks Join for an auto-login link and the front opens it; any failure shows an error and opens nothing.", "refs": ["cu-ho-token-mgr", "cu-ho-join-client", "cu-ho-open"] }
  ],
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "GET /v3/api/shops · GET /v3/api/licenses · GET /v3/api/users/administrators · GET /v3/api/current_user — accessible active shops, can_hire licences and administrators (system admin only), the caller's language"
    },
    {
      "from": "skello-app-front",
      "to": "svc-hiring",
      "action": "POST /join_token — SetupRequestDto: organisation, active hiring_join shops, users who can hire"
    },
    {
      "from": "svc-hiring",
      "to": "skello-app",
      "action": "POST /private/organisations/:organisation_id/access_keys — mint the organisation's partner access key (first setup only)"
    },
    {
      "from": "svc-hiring",
      "to": "svc-communications-v2",
      "action": "POST /email/low-priority — account-created (new admins), welcome (new non-admins), grouped-error or auth-token-error (all admins)"
    },
    {
      "from": "svc-hiring",
      "to": "skello-app-front",
      "action": "HTTP 200 {redirectUrl, expiresIn} — the front opens Join in a new tab"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-ho-navbar",
      "service": "skello-app-front",
      "kind": "component",
      "label": "useNavbarLinks",
      "path": "apps/base-app/src/pages/App/sections/Navbar/sections/NavbarLinks/hooks/useNavbarLinks/useNavbarLinks.ts",
      "description": "The navbar's Hiring entry: visible with the FEATURE_JOIN_HIRING country flag and the canHire permission; shows the hiring-upsell modal when the hiring_join shop feature is off, otherwise calls openHiring"
    },
    {
      "id": "cu-ho-open",
      "service": "skello-app-front",
      "kind": "component",
      "label": "useOpenHiring",
      "path": "apps/base-app/src/pages/App/sections/Navbar/sections/NavbarLinks/hooks/useOpenHiring/useOpenHiring.ts",
      "description": "Builds the SetupRequestDto (the caller's accessible active shops with hiring_join; can_hire administrators for a system admin — the admin alone when licences are unreadable — the manager alone otherwise), requests the Join token and opens redirectUrl in a new tab; any error shows the errors.hiring.open_failed snackbar"
    },
    {
      "id": "cu-ho-api",
      "service": "skello-app-front",
      "kind": "client",
      "label": "useGenerateJoinTokenApi",
      "path": "apps/base-app/src/apis/svcHiring/JoinToken/joinTokenApis.ts",
      "description": "Mutation over svcHiringRepository.generateJoinToken — POST /join_token through the svc-hiring SDK, JWT attached, 30-second timeout"
    },
    {
      "id": "cu-ho-controller",
      "service": "svc-hiring",
      "kind": "controller",
      "label": "JoinTokenController",
      "path": "src/Controller/JoinTokenController.ts",
      "description": "Structurally validates the body (loose JoinTokenRequestDto; content is left for Join to reject), then checks OrganisationIdPermissionCheck for JWT callers: a super admin, or a user of the request's organisation (403 otherwise)"
    },
    {
      "id": "cu-ho-token-mgr",
      "service": "svc-hiring",
      "kind": "manager",
      "label": "JoinTokenManager",
      "path": "src/Manager/JoinTokenManager.ts",
      "description": "mintToken: ensures a partner access key (skipped once the company row exists), runs JoinSetupManager.createAll, sends the outcome emails, blocks only on a company or connecting-user failure (503 transient, 422 permanent), then generates the Join auth token; a Join 404 deletes the user's status row so the next click re-provisions it"
    },
    {
      "id": "cu-ho-skello-client",
      "service": "svc-hiring",
      "kind": "client",
      "label": "SkelloClient",
      "path": "src/Client/SkelloClient.ts",
      "description": "createOrganisationAccessKey — POST /private/organisations/:organisation_id/access_keys with the Skello App API key; the monolith stores the hashed employees:read access key in the svcUsers DynamoDB table and returns its skl_ token, which Join uses to call back into Skello"
    },
    {
      "id": "cu-ho-setup-mgr",
      "service": "svc-hiring",
      "kind": "manager",
      "label": "JoinSetupManager",
      "path": "src/Manager/JoinSetupManager.ts",
      "description": "createAll: creates the Join company (with its first user), then each remaining user under a 15-second DynamoDB lease, then each office — each only when its status row is absent, recorded with a conditional write; Join failures are bucketed retryable or permanent, never thrown"
    },
    {
      "id": "cu-ho-join-client",
      "service": "svc-hiring",
      "kind": "client",
      "label": "JoinClient",
      "path": "src/Client/JoinClient.ts",
      "description": "Signed calls to the Join partner API (JOIN_API_BASE_URL; HMAC-SHA1 signature, 10-second timeout, no retry): create company, users and offices, and POST /auth/token for the auto-login redirectUrl"
    },
    {
      "id": "cu-ho-notifier",
      "service": "svc-hiring",
      "kind": "client",
      "label": "SvcCommunicationJoinEmailNotifier",
      "path": "src/Notifier/SvcCommunicationJoinEmailNotifier.ts",
      "description": "Account-created email to each admin and welcome email to each non-admin freshly created on Join in this run; grouped-error (permanent failures with displayable errors) and auth-token-error emails to every admin — each through SvcCommunicationRepository and svc-communications-v2 low-priority email"
    }
  ],
  "codeEdges": [
    { "from": "cu-ho-navbar", "to": "cu-ho-open", "label": "openHiring", "mode": "sync" },
    { "from": "cu-ho-open", "to": "cu-ho-api", "label": "generateJoinToken(payload)", "mode": "sync" },
    {
      "from": "cu-ho-api", "to": "svc-hiring", "label": "POST /join_token", "mode": "sync",
      "auth": { "tokenType": "jwt", "authorizer": "SkelloLambdaAuthorizer" }
    },
    {
      "from": "svc-hiring", "to": "cu-ho-controller", "label": "createAction", "mode": "sync",
      "auth": { "tokenType": "jwt", "gate": "OrganisationIdPermissionCheck" }
    },
    { "from": "cu-ho-controller", "to": "cu-ho-token-mgr", "label": "mintToken", "mode": "sync" },
    { "from": "cu-ho-token-mgr", "to": "dynamo-svc-hiring", "label": "company row (skip key mint); delete stale user row on a Join 404", "mode": "sync", "crud": ["read", "delete"] },
    { "from": "cu-ho-token-mgr", "to": "cu-ho-skello-client", "label": "createOrganisationAccessKey", "mode": "sync", "condition": "first setup: no partner key and no company row" },
    {
      "from": "cu-ho-skello-client", "to": "skello-app", "label": "POST /private/organisations/:organisation_id/access_keys", "mode": "sync",
      "auth": { "tokenType": "api-key" }
    },
    { "from": "cu-ho-token-mgr", "to": "cu-ho-setup-mgr", "label": "createAll", "mode": "sync" },
    { "from": "cu-ho-setup-mgr", "to": "dynamo-svc-hiring", "label": "status rows, provisioning lease", "mode": "sync", "crud": ["read", "create"] },
    { "from": "cu-ho-setup-mgr", "to": "cu-ho-join-client", "label": "createCompany, createUser, createOffice", "mode": "sync" },
    { "from": "cu-ho-token-mgr", "to": "cu-ho-notifier", "label": "accountCreated, welcome, groupedError, authTokenError (on token failure)", "mode": "sync" },
    { "from": "cu-ho-notifier", "to": "svc-communications-v2", "label": "SvcCommunicationRepository → emailRepository.createLowPriority", "mode": "sync" },
    { "from": "cu-ho-token-mgr", "to": "cu-ho-join-client", "label": "generateAuthToken → redirectUrl", "mode": "sync" }
  ],
  "branches": [
    {
      "id": "upsell",
      "at": "cu-ho-navbar",
      "when": "Hiring is not enabled for the shop (hiring_join off)",
      "outcome": "the hiring-upsell modal opens; svc-hiring is not called",
      "evidence": { "literal": "hiring-upsell" }
    },
    {
      "id": "other-organisation",
      "at": "cu-ho-controller",
      "when": "the caller does not belong to the request's organisation",
      "outcome": "403 Forbidden, nothing provisioned",
      "status": 403,
      "evidence": { "literal": "OrganisationIdPermissionCheck" }
    },
    {
      "id": "no-access-key",
      "at": "cu-ho-token-mgr",
      "when": "the access-key call to the monolith fails",
      "outcome": "503; the front shows the open-failed snackbar and the next click retries",
      "status": 503,
      "evidence": { "literal": "Could not obtain a Join access key from Skello, please retry" }
    },
    {
      "id": "stale-join-user",
      "at": "cu-ho-token-mgr",
      "when": "Join has no record of the connecting user (404 on the auth token)",
      "outcome": "422; the user's status row is deleted so the next click re-provisions them",
      "status": 422,
      "evidence": { "literal": "Join has no record of this account; it will be re-provisioned on the next attempt" }
    },
    {
      "id": "open-failed",
      "at": "cu-ho-open",
      "when": "any error or timeout from svc-hiring",
      "outcome": "an error snackbar; no tab opens",
      "evidence": { "literal": "errors.hiring.open_failed" }
    }
  ],
  "infraNodes": [
    {
      "id": "dynamo-svc-hiring",
      "type": "dynamodb",
      "label": "svcHiring-{env}",
      "resources": ["ddb:svcHiring"],
      "description": "Join status rows per organisation — company (SK O), office (SHOP#id), user (EMPLOYEE#id) — and the 15-second user-provisioning lease"
    },
    {
      "id": "dynamo-svc-users-access-key",
      "type": "dynamodb",
      "label": "svcUsers-{env} (access keys)",
      "resources": ["ddb:svcUsers"],
      "description": "The monolith's access-key store: the hashed employees:read key for the organisation (Skello::AccessKey::AccessKeyService)"
    }
  ],
  "infraEdges": [
    { "from": "svc-hiring", "to": "dynamo-svc-hiring", "label": "read, create and delete status rows", "crud": ["read", "create", "delete"] },
    { "from": "skello-app", "to": "dynamo-svc-users-access-key", "label": "store the hashed access key", "crud": ["create"] }
  ]
})

export default hiring_open
