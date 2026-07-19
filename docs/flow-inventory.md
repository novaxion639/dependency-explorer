# Flow Inventory — every user-facing flow the platform can produce

Cross-reference of the whole product surface against the modelled flows.
Sources: the monolith's controller tree (`skello-app/app/controllers`), the
front's section roots, the mobile apps, and the dependency map's
services/connections. The planning section has its own action-level tracker
in [planning-actions-coverage.md](planning-actions-coverage.md).

## Current coverage (generated)

<!-- GENERATED:flows-by-domain BEGIN — run `pnpm docs:gen`, do not edit inside -->
**48 modelled flows** across 37 services — every flow carries a code layer and a trigger.

| Domain | Flows | Ids |
|---|---|---|
| Core | 46 | `assistant-chat` `analytics-dashboard-load` `availability-submission` `badging-review` `employee-clock-in` `mobile-clock-in` `mobile-app-bootstrap` `mobile-planning-management` `mobile-shift-swap-request` `mobile-documents-payslips` `punchclock-device-setup` `self-serve-signup` `subscription-upgrade` `employee-onboarding` `payroll-export` `leave-request-lifecycle` `document-generation-esignature` `auto-planning-generation` `bff-dashboard-load` `shift-creation` `shift-deletion` `shift-update` `shift-publication` `leave-request-cancellation` `workload-plan-consultation` `leave-request-approval` `workload-plan-creation` `shift-replacement-search` `planning-page-load` `week-copy` `planning-report-export` `planning-period-lock` `absence-creation` `shift-bulk-erase` `shift-swap` `planning-event-management` `planning-template` `contract-amendment` `employee-archival` `staff-register-export` `inbound-webhooks` `assistant-freemium-credits` `pos-revenue-ingestion` `document-share` `mission-management` `org-onboarding` |
| Communications | 18 | `payslip-dispatch` `mobile-app-bootstrap` `self-serve-signup` `subscription-upgrade` `employee-onboarding` `payroll-export` `leave-request-lifecycle` `document-generation-esignature` `shift-creation` `shift-publication` `leave-request-approval` `planning-period-lock` `absence-creation` `shift-bulk-erase` `shift-swap` `contract-amendment` `employee-archival` `document-share` |
| Human Resources | 16 | `assistant-chat` `payslip-dispatch` `mobile-documents-payslips` `employee-onboarding` `payroll-export` `leave-request-lifecycle` `document-generation-esignature` `employee-hris-sync` `shift-deletion` `leave-request-cancellation` `leave-request-approval` `shift-bulk-erase` `contract-amendment` `staff-register-export` `document-share` `mission-management` |
| Platform | 9 | `payslip-dispatch` `mobile-app-bootstrap` `punchclock-device-setup` `subscription-upgrade` `bff-dashboard-load` `shift-publication` `workload-plan-consultation` `employee-archival` `mission-management` |
| Intelligence | 8 | `assistant-chat` `payslip-dispatch` `bff-dashboard-load` `workload-plan-consultation` `planning-report-export` `assistant-freemium-credits` `pos-revenue-ingestion` `org-onboarding` |
| Scheduling | 7 | `assistant-chat` `auto-planning-generation` `workload-plan-consultation` `workload-plan-creation` `shift-replacement-search` `planning-page-load` `pos-revenue-ingestion` |
| Time & Attendance | 6 | `badging-review` `employee-clock-in` `mobile-clock-in` `punchclock-device-setup` `employee-archival` `pos-revenue-ingestion` |
| Billing | 5 | `assistant-chat` `self-serve-signup` `subscription-upgrade` `assistant-freemium-credits` `org-onboarding` |

Every domain has at least one modelled flow.
<!-- GENERATED:flows-by-domain END -->

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
