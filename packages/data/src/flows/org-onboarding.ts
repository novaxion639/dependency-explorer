import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// P2 coverage arc, traced 2026-07-20. Two orthogonal "onboarding" systems
// coexist; the trace is complete from the org-creation form onward — the
// standalone SkelloOnboarding/SelfServe fronts are not checked out, so the
// pre-provisioning signup UI stays out of the code layer (recorded boundary).
const org_onboarding: ServiceFlow = ServiceFlowSchema.parse({
  "id": "org-onboarding",
  "name": "Organisation Onboarding & Provisioning",
  "description": "Post-signup, an authenticated user without an organisation completes the org-creation forms; the monolith's Onboarding::OrganisationsController + Organisations::UpsertService provision everything transactionally: Organisation, default licenses, the creator's affiliation (user_license + contract), the default text-document template, and the Prospect state-machine step (organisation_created); update toggles pack features and default postes and stamps free_trial_started_at for self-serve orgs. TWO ONBOARDING SYSTEMS then coexist, selected by FEATUREDEV_PLANNING_ONBOARDING_MS_ENROLLMENT: the LEGACY admin_onboarding modal (7 steps — launch → profiling → convention → LLM planning import via the svc-intelligence websocket → employees → positions → loading) provisions through monolith REST and NEVER touches svc-enrollment; the NEW branch persists per-shop progress payloads (FlowEnum PLANNING | TIMECLOCK — shop-level, never org-level) in svc-enrollment's DynamoDB, which is a self-contained JWT-authed store: it writes NOTHING back to the monolith (verified — no Skello client in src/) and only streams to the data lake via Firehose. svc-enrollment's EmployeeOnboardingController is a separate HR-config feature, not this journey.",
  "trigger": { "actor": "prospect", "role": "authenticated user without_organisation? (create) · system_admin for the onboarding journey" },
  "links": [
    { "to": "self-serve-signup", "kind": "continuation", "note": "sign-up produces the authenticated user + Prospect this flow provisions; self_serve orgs get free_trial_started_at on activation" }
  ],
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST/PATCH /v3/api/onboarding/organisations (+ prospects current/update) — org provisioning"
    },
    {
      "from": "skello-app-front",
      "to": "svc-intelligence",
      "action": "LEGACY branch — LLM planning import over the websocket (admin_onboarding llm step)"
    },
    {
      "from": "skello-app-front",
      "to": "svc-enrollment",
      "action": "NEW branch (FF) — onboarding progress payloads per (shopId, flow) over JWT"
    },
    {
      "from": "svc-enrollment",
      "to": "svc-enrollment",
      "action": "DynamoDB stream → Firehose → data lake (no monolith write-back exists)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-oo-org-form",
      "service": "skello-app-front",
      "kind": "component",
      "label": "OrganisationForm",
      "path": "apps/vue-app/src/onboarding/organisation_creation/pages/OrganisationForm.vue",
      "description": "Org creation UI (organisation_creation → shop form → billing forms) — dispatches createOrganisation"
    },
    {
      "id": "cu-oo-onb-store",
      "service": "skello-app-front",
      "kind": "client",
      "label": "createOrganisation (onboarding store)",
      "path": "apps/vue-app/src/shared/store/modules/onboarding.js",
      "description": "POST/PATCH /v3/api/onboarding/organisations + prospect reads/updates"
    },
    {
      "id": "cu-oo-admin-onb",
      "service": "skello-app-front",
      "kind": "component",
      "label": "AdminOnboarding",
      "path": "apps/vue-app/src/admin_onboarding/AdminOnboarding.vue",
      "description": "LEGACY 7-step modal — users/postes/licenses via monolith REST + the svc-intelligence LLM websocket; no svc-enrollment"
    },
    {
      "id": "cu-oo-enroll-store",
      "service": "skello-app-front",
      "kind": "client",
      "label": "enrollment store (svcEnrollmentClient)",
      "path": "apps/vue-app/src/shared/store/modules/enrollment.js",
      "description": "NEW branch — getOne/create/updateOnboarding per (shopId, FlowEnum PLANNING|TIMECLOCK), JWT via getAuthToken"
    },
    {
      "id": "cu-oo-mono-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::Onboarding::OrganisationsController",
      "path": "app/controllers/v3/api/onboarding/organisations_controller.rb",
      "description": "show/create/update — authorize without_organisation? (create) / valid_account?; transactional, RecordInvalid → 422; self-serve free-trial stamping"
    },
    {
      "id": "cu-oo-upsert",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::Organisations::UpsertService",
      "path": "app/services/v3/organisations/upsert_service.rb",
      "description": "Provisions Organisation + default licenses + creator affiliation (user_license, contract) + text-document template; transitions Prospect to organisation_created; seeds User.onboarding_employee for the profiling step"
    },
    {
      "id": "cu-oo-enroll-controller",
      "service": "svc-enrollment",
      "kind": "controller",
      "label": "OnboardingController",
      "path": "src/Controller/OnboardingController.ts",
      "description": "create/getOne/getAll/update onboarding progress — JWT + grantSystemAdmin"
    },
    {
      "id": "cu-oo-enroll-mgr",
      "service": "svc-enrollment",
      "kind": "manager",
      "label": "OnboardingManager",
      "path": "src/Manager/OnboardingManager.ts",
      "description": "DTO ↔ model ↔ entity mapping; upsert"
    },
    {
      "id": "cu-oo-enroll-repo",
      "service": "svc-enrollment",
      "kind": "service",
      "label": "OnboardingDynamoDBRepository",
      "path": "src/Repository/OnboardingDynamoDBRepository.ts",
      "description": "Upsert / findOneByShopIdAndFlow / findAllByShopId — PK Onboarding#{shopId}, SK flow"
    },
    {
      "id": "cu-oo-firehose",
      "service": "svc-enrollment",
      "kind": "job",
      "label": "TriggerFirehoseStreamHandler",
      "path": "src/Handler/DynamoDB/TriggerFirehoseStreamHandler.ts",
      "description": "DynamoDB-stream consumer — ReplicationModel batches to the data-lake Firehose"
    }
  ],
  "codeEdges": [
    { "from": "cu-oo-org-form", "to": "cu-oo-onb-store", "label": "createOrganisation", "mode": "sync" },
    { "from": "cu-oo-onb-store", "to": "skello-app", "label": "POST/PATCH onboarding/organisations", "mode": "sync" },
    { "from": "skello-app", "to": "cu-oo-mono-controller", "label": "onboarding routes", "mode": "sync" },
    {
      "from": "cu-oo-mono-controller", "to": "cu-oo-upsert", "label": "UpsertService",
      "mode": "sync", "inTransaction": true, "crud": ["create", "update"]
    },
    { "from": "cu-oo-upsert", "to": "pg-skello-onboarding", "label": "org + licenses + affiliation + template + prospect step", "mode": "sync", "inTransaction": true, "crud": ["create", "update"] },
    {
      "from": "cu-oo-admin-onb", "to": "skello-app", "label": "users / postes / licenses REST (legacy steps)",
      "mode": "sync", "condition": "legacy branch — FF off"
    },
    {
      "from": "cu-oo-admin-onb", "to": "svc-intelligence", "label": "LLM planning import (websocket)",
      "mode": "async-event", "condition": "legacy llm step",
      "failure": { "dlqAbsent": "confirmed-missing", "onError": "Fire-and-forget websocket exchange — a dropped LLM import leaves the onboarding step to be retried by the admin" }
    },
    {
      "from": "cu-oo-enroll-store", "to": "svc-enrollment", "label": "onboarding progress (JWT)",
      "mode": "sync", "condition": "FF FEATUREDEV_PLANNING_ONBOARDING_MS_ENROLLMENT — branch selected in App.vue's redirect, outside the modeled units, so the ref stays prose"
    },
    { "from": "svc-enrollment", "to": "cu-oo-enroll-controller", "label": "onboarding routes", "mode": "sync" },
    { "from": "cu-oo-enroll-controller", "to": "cu-oo-enroll-mgr", "label": "upsert / reads", "mode": "sync" },
    { "from": "cu-oo-enroll-mgr", "to": "cu-oo-enroll-repo", "label": "OnboardingDynamoDBRepository", "mode": "sync", "crud": ["create", "read", "update"] },
    { "from": "cu-oo-enroll-repo", "to": "dynamo-enrollment", "label": "Onboarding#{shopId} / flow", "mode": "sync", "crud": ["create", "read", "update"] },
    {
      "from": "dynamo-enrollment", "to": "cu-oo-firehose", "label": "stream → Firehose",
      "mode": "async-event",
      "failure": { "queue": "TriggerFirehoseStreamHandler", "dlq": "TriggerDatalakeFirehoseStreamSqsDlq", "onError": "A dead-lettered batch loses only the analytics replica — onboarding progress itself is committed" }
    },
    { "from": "cu-oo-firehose", "to": "kinesis-enrollment-datalake", "label": "ReplicationModel batches", "mode": "async-event", "crud": ["create"] }
  ],
  "infraNodes": [
    { "id": "pg-skello-onboarding", "type": "postgresql", "label": "skello_production — organisations, licenses, contracts, prospects", "description": "Everything the provisioning transaction writes" },
    { "id": "dynamo-enrollment", "type": "dynamodb", "label": "svcEnrollment-{env} (+stream)", "description": "Per-(shopId, flow) onboarding progress payloads — self-contained, no monolith write-back" },
    { "id": "kinesis-enrollment-datalake", "type": "kinesis", "label": "svc-enrollment Firehose → data lake", "description": "Analytics replication of onboarding progress" }
  ],
  "infraEdges": [
    { "from": "skello-app", "to": "pg-skello-onboarding", "label": "provisioning writes", "crud": ["create", "update"] },
    { "from": "svc-enrollment", "to": "dynamo-enrollment", "label": "progress upserts", "crud": ["create", "read", "update"] },
    { "from": "svc-enrollment", "to": "kinesis-enrollment-datalake", "label": "datalake replication", "crud": ["create"] }
  ]
})

export default org_onboarding
