# Flow Inventory — every user-facing flow the platform can produce

Cross-reference of the whole product surface against the modelled flows.
Sources: the monolith's controller tree (`skello-app/app/controllers`), the
front's section roots, the mobile apps, and the dependency map's
services/connections. The planning section has its own action-level tracker
in [planning-actions-coverage.md](planning-actions-coverage.md).

## Current coverage (generated)

<!-- GENERATED:flows-by-area BEGIN — run `pnpm docs:gen`, do not edit inside -->
**48 modelled flows** across 37 services — every flow carries a code layer, a trigger and a primary area.

| Product area | Flows | Ids |
|---|---|---|
| Planning | 13 | `mobile-planning-management` `shift-creation` `shift-deletion` `shift-update` `shift-publication` `planning-page-load` `week-copy` `planning-period-lock` `absence-creation` `shift-bulk-erase` `shift-swap` `planning-event-management` `planning-template` |
| Leave & requests | 5 | `availability-submission` `mobile-shift-swap-request` `leave-request-lifecycle` `leave-request-cancellation` `leave-request-approval` |
| Employees & HR file | 5 | `employee-onboarding` `employee-hris-sync` `contract-amendment` `employee-archival` `staff-register-export` |
| Time & attendance | 4 | `badging-review` `employee-clock-in` `mobile-clock-in` `punchclock-device-setup` |
| Documents & e-signature | 4 | `payslip-dispatch` `mobile-documents-payslips` `document-generation-esignature` `document-share` |
| Billing & subscription | 4 | `self-serve-signup` `subscription-upgrade` `inbound-webhooks` `assistant-freemium-credits` |
| Workload & forecasting | 3 | `workload-plan-consultation` `workload-plan-creation` `pos-revenue-ingestion` |
| Automatic scheduling | 2 | `auto-planning-generation` `shift-replacement-search` |
| Payroll & reports | 2 | `payroll-export` `planning-report-export` |
| Analytics & dashboards | 2 | `analytics-dashboard-load` `bff-dashboard-load` |
| Organisation & shop admin | 2 | `mobile-app-bootstrap` `org-onboarding` |
| Missions | 1 | `mission-management` |
| Counters & labour law | 0 | — |
| Hiring | 0 | — |

Product areas with no flow yet: Counters & labour law, Hiring.

Flows owned by a platform capability: `assistant-chat`.
<!-- GENERATED:flows-by-area END -->

---

## Surface classes that are NOT candidate flows

| Class | Surface | Why |
|---|---|---|
| Service write-backs | `private/svc_*` controllers (16: employees, users, shops, requests, documents…) | Segments of existing service flows, already modelled as connections/steps |
| Super-admin | `super_admin/api/**` (25+ controllers) | Internal back-office tool, different audience |
| UI-only actions | sort/filter/display toggles | No cross-service or storage consequence |
| Session plumbing | `current_user`, `current_license`, `config`, `feature_flags`… | Context loading, not flows |

---

## Remaining candidate flows

The nine-candidate backlog from the 2026-07-19 refresh is fully built
(contract-amendment, employee-archival, assistant-freemium-credits,
pos-revenue-ingestion, document-share, org-onboarding, mission-management,
inbound-webhooks — the outbound-webhook premise proved false in deployed
code — and staff-register-export). New candidates enter through the
surface sweep or the action tracker below.

Planning-section action gaps (drag-and-drop variants, validate day, popular
shifts, shift tasks/comments, optimization side panel, schedule
recommendation…) are tracked action-by-action in
[planning-actions-coverage.md](planning-actions-coverage.md).
