# Flow Inventory — every user-facing flow the platform can produce

Cross-reference of the whole product surface against the modelled flows.
Sources: the monolith's controller tree (`skello-app/app/controllers`), the
front's section roots, the mobile apps, and the dependency map's
services/connections. The planning section has its own action-level tracker
in [planning-actions-coverage.md](planning-actions-coverage.md).

## Current coverage (generated)

<!-- GENERATED:flows-by-domain BEGIN — run `pnpm docs:gen`, do not edit inside -->
**39 modelled flows** across 37 services — every flow carries a code layer and a trigger.

| Domain | Flows | Ids |
|---|---|---|
| Core | 37 | `assistant-chat` `analytics-dashboard-load` `availability-submission` `badging-review` `employee-clock-in` `mobile-clock-in` `mobile-app-bootstrap` `mobile-planning-management` `mobile-shift-swap-request` `mobile-documents-payslips` `punchclock-device-setup` `self-serve-signup` `subscription-upgrade` `employee-onboarding` `payroll-export` `leave-request-lifecycle` `document-generation-esignature` `auto-planning-generation` `bff-dashboard-load` `shift-creation` `shift-deletion` `shift-update` `shift-publication` `leave-request-cancellation` `workload-plan-consultation` `leave-request-approval` `workload-plan-creation` `shift-replacement-search` `planning-page-load` `week-copy` `planning-report-export` `planning-period-lock` `absence-creation` `shift-bulk-erase` `shift-swap` `planning-event-management` `planning-template` |
| Communications | 15 | `payslip-dispatch` `mobile-app-bootstrap` `self-serve-signup` `subscription-upgrade` `employee-onboarding` `payroll-export` `leave-request-lifecycle` `document-generation-esignature` `shift-creation` `shift-publication` `leave-request-approval` `planning-period-lock` `absence-creation` `shift-bulk-erase` `shift-swap` |
| Human Resources | 12 | `assistant-chat` `payslip-dispatch` `mobile-documents-payslips` `employee-onboarding` `payroll-export` `leave-request-lifecycle` `document-generation-esignature` `employee-hris-sync` `shift-deletion` `leave-request-cancellation` `leave-request-approval` `shift-bulk-erase` |
| Platform | 7 | `payslip-dispatch` `mobile-app-bootstrap` `punchclock-device-setup` `subscription-upgrade` `bff-dashboard-load` `shift-publication` `workload-plan-consultation` |
| Scheduling | 6 | `assistant-chat` `auto-planning-generation` `workload-plan-consultation` `workload-plan-creation` `shift-replacement-search` `planning-page-load` |
| Intelligence | 5 | `assistant-chat` `payslip-dispatch` `bff-dashboard-load` `workload-plan-consultation` `planning-report-export` |
| Time & Attendance | 4 | `badging-review` `employee-clock-in` `mobile-clock-in` `punchclock-device-setup` |
| Billing | 3 | `assistant-chat` `self-serve-signup` `subscription-upgrade` |

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

Flows the surface sweep identified that are not yet modelled. Authored flows
carry every expressiveness dimension from day one (trigger, code layer, and
the rule/flag/failure/auth/link fields where applicable) — the schema landed
before this backlog on purpose, so nothing here gets authored twice.

| Candidate | Priority | Sketch |
|---|---|---|
| `contract-amendment` | MEDIUM | Amendment → esignature? → payroll/counter impact |
| `employee-archival` | MEDIUM | Archival consequences across replicas (search raw collections, punch permissions) |
| `assistant-freemium-credits` | MEDIUM | AI chat credit check/decrement leg (assistant→billing) as its own flow |
| `pos-revenue-ingestion` | MEDIUM | Tills → svc-pos (Chift/REVO/Agora) → kpis-v2 revenue → workload calibration |
| `document-share` | LOW | Upload/share a document to employees |
| `org-onboarding` | MEDIUM | svc-enrollment path — partially blocked on unmapped SkelloOnboarding/SelfServe fronts |
| `mission-management` | LOW-MED | Front `missions/` + `v3/api/missions` + svc-shops mission processors |
| `third-party-webhook` | LOW | Inbound webhooks surface (`v3/api/webhooks`) |
| `staff-register-export` | LOW | Legal document export |

Planning-section action gaps (drag-and-drop variants, validate day, popular
shifts, shift tasks/comments, optimization side panel, schedule
recommendation…) are tracked action-by-action in
[planning-actions-coverage.md](planning-actions-coverage.md).
