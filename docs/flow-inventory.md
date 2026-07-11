# Flow Inventory — every user-facing flow the platform can produce

Cross-reference of the whole product surface against the 23 modelled flows.
Sources: the monolith's controller tree (`skello-app/app/controllers` — ~250
controllers), the front's section roots (`skello-app-front/apps/vue-app/src`)
and service API clients (`apps/base-app/src/apis`), and the dependency map's
services/connections. The planning section has its own action-level tracker in
[planning-actions-coverage.md](planning-actions-coverage.md); this inventory
covers the org-wide picture at flow granularity.

**Modelled: 23 flows, concentrated on planning (~80% of them). Six product
domains have zero flows.**

---

## Surface classes that are NOT candidate flows

| Class | Surface | Why |
|---|---|---|
| Service write-backs | `private/svc_*` controllers (16: employees, users, shops, requests, documents…) | Segments of existing service flows, already modelled as connections/steps |
| Super-admin | `super_admin/api/**` (25+ controllers) | Internal back-office tool, different audience |
| UI-only actions | sort/filter/display toggles | No cross-service or storage consequence |
| Session plumbing | `current_user`, `current_license`, `config`, `feature_flags`… | Context loading, not flows |

---

## Domain-by-domain inventory

### 1. Planning — well covered
Entry: front `plannings/` section, `v3/api/plannings/**` (15+5 controllers).
**18 of 23 flows live here** (creation/update/deletion/copy/publication/lock/
templates/events/swap/replacement/bulk-erase/auto-planning/workload/exports/
page-load). Remaining action-level gaps tracked in planning-actions-coverage.md
(drag-and-drop variants, day validation, popular shifts, shift tasks/comments,
optimization side panel, schedule recommendation).

### 2. Time clock / badging — ZERO flows ⚠ highest-value gap
Entry: front `badgings/` + `timeclock_onboarding/`, `v3/api/badgings` (4),
`punch_clock/v1` (4), the SkelloPunchClock app, svc-punch, svc-users
(EmployeePunchPermission, token provisioning — an existing verified edge).

| Candidate flow | Priority | Sketch |
|---|---|---|
| `employee-clock-in` | **HIGH** | Punch app → token (svc-users) → badging row → shift matching → counter effects; update flow already shows badging unlink on unassign |
| `badging-review` | MEDIUM | Manager reviews/adjusts badgings vs planned shifts (`badgings` controllers) |
| `timeclock-setup` | LOW | Shop timeclock onboarding |

### 3. Employee lifecycle — one flow (hris-sync)
Entry: front `employees/` + `users/`, `v3/api/employees|users/**` (11),
`contracts`, `contract_amendments`, `dpae_deposits`, `staff_registers`, `hr`.

| Candidate flow | Priority | Sketch |
|---|---|---|
| `employee-onboarding` | **HIGH** | Create employee → contract → DPAE deposit (URSSAF via Fortify cluster per GLOBAL board) → invitation (svc-users `api-invite-user`, comms welcome email — existing verified edges) |
| `contract-amendment` | MEDIUM | Amendment → esignature? → payroll/counter impact |
| `employee-archival` | MEDIUM | Archival consequences across replicas (search raw collections, punch permissions) |

### 4. Billing / subscription — ZERO flows
Entry: front `organisation_settings/`, `v3/api/billing_automation` (5),
`billing_infos`, `sepa`, `upsells`, `self_serve`, `registrations`, `prospects`;
svc-billing-automation ↔ Chargebee/Salesforce (verified).

| Candidate flow | Priority | Sketch |
|---|---|---|
| `subscription-upgrade` | **HIGH** | Upsell → billing-automation → Chargebee; websocket ping on completion (verified billing→legacy-websockets edge) |
| `self-serve-signup` | **HIGH** | Registration → svc-users `POST /sign-up` (ALB, restored 2026-06-10) → org provisioning → enrollment; touches the unmapped SelfServe front |
| `assistant-freemium-credits` | **HIGH** | AI chat → credit check/decrement (assistant→billing, restored edge) — pairs with #5 |

### 5. AI assistant — ZERO flows
Entry: front `svcSkelloAssistant` client; svc-skello-assistant's five verified
edges (billing credits, docs-v2, esignature status, search Mongo, shifts MCP)
plus the svc-intelligence shared-Mongo checkpoint store.

| Candidate flow | Priority | Sketch |
|---|---|---|
| `assistant-chat` | **HIGH** — showcase-grade | Chat turn: credits gate → LangGraph (Bedrock/Anthropic) → MCP tools fan-out (shifts API, docs-v2, search Mongo reads) → checkpoints in svc-int Mongo. Every edge already code-verified |

### 6. Documents — one flow (esignature generation)
Entry: front `text_document_templates/` + `users/documents`,
`request_esignatures`, `text_documents`; svc-documents-v2, svc-intelligence.

| Candidate flow | Priority | Sketch |
|---|---|---|
| `payslip-dispatch` | MEDIUM | The SvcIntelligence "Payslip dispatch" FigJam board (unswept) describes it — verify board + code together |
| `document-share` | LOW | Upload/share a document to employees |

### 7. Integrations / payroll — ZERO flows
Entry: `v3/api/integrations` (3) + `super_admin/api/integrations` (7),
`third_parties`, `organisation_credentials`, `v3/api/webhooks`; svc-payroll,
svc-pos, the Fortify↔Silae/Urssaf/Cegedim cluster (GLOBAL board).

| Candidate flow | Priority | Sketch |
|---|---|---|
| `payroll-export` | **HIGH** | Export to payroll software: monolith Sidekiq + svc-reports PAM configs (partially in `planning-report-export`) + svc-payroll→hris/comms edges + Silae via Fortify |
| `pos-revenue-ingestion` | MEDIUM | Tills → svc-pos (Chift/REVO/Agora) → kpis-v2 revenue → workload calibration (edges exist; no flow narrates it) |
| `third-party-webhook` | LOW | Inbound webhooks surface |

### 8. Requests (employee-initiated) — covered for leave
`leave-request-*` ×3 exist. Gaps: `availability-submission` (api/v2/availabilities,
MEDIUM), employee-side swap requests if distinct from `shift-swap` (LOW).

### 9. Analytics / reporting — partially covered
`bff-dashboard-load` + `planning-report-export` exist. Gaps:
`analytics-dashboard-load` (front `analytics_dashboard/` — legacy svcKpis
client still declared in front, MEDIUM + doubles as v1-retirement evidence),
`staff-register-export` (LOW, legal doc).

### 10. Onboarding / enrollment — ZERO flows
Entry: front `onboarding/` + `admin_onboarding/`, `v3/api/onboarding`,
svc-enrollment (+ unmapped SkelloOnboarding/SelfServe fronts per GLOBAL board).
Candidate: `org-onboarding` (MEDIUM — blocked on unmapped front apps).

### 11. Mobile — out of map
`api/v1|v2` + `v3/api/mobile` + SkelloMobile/SkelloPunchClock apps (unmapped
services per GLOBAL board). Inventory only — mobile app modelling is a
map-scope decision, not a flow authoring task.

### 12. Missions — ZERO flows
Front `missions/` + `v3/api/missions` + svc-shops MissionWage/MissionHours
processors reading search Mongo (verified). Candidate: `mission-management`
(LOW-MED).

---

## Ranked next candidates

| # | Flow | Why first |
|---|---|---|
| 1 | `assistant-chat` | Showcase-grade: AI + freemium + 6 verified edges incl. shared-Mongo patterns; zero new verification needed |
| 2 | `employee-clock-in` | Biggest unmodelled product domain (time clock); connects punch/users/monolith |
| 3 | `self-serve-signup` | Uses the restored `POST /sign-up`; touches billing + enrollment |
| 4 | `subscription-upgrade` | Billing domain entry; Chargebee + websocket ping already verified |
| 5 | `employee-onboarding` | HR core; DPAE/Fortify external cluster |
| 6 | `payroll-export` | Completes the payroll story around svc-payroll/svc-reports |

## Discovery finds adopted during this inventory

- **svc-hiring — 34th service in the map** (adopted 2026-06-15): bridge to the
  Join hiring/ATS product. Two verified edges: skello-app-front → svc-hiring
  (`POST /join_token`, navbar auto-login into Join) and skello-app → svc-hiring
  (`Microservices::HiringService` → `POST /setup`). Repo not checked out —
  endpoints are the evidenced call sites only.
- **skello-app-front → svc-payroll** (adopted 2026-06-15): the Pay Partners
  settings page reads variable pay elements and export templates
  (`svc_payroll_client.js`, `api-evps-list`).
- Front still ships `svcKpis` (legacy v1) and `skello-analytics-client` clients —
  known unknown-targets; the analytics-dashboard flow would settle their status.
