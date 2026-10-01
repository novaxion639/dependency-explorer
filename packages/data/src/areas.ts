import { ProductAreaSchema } from '@dependency-explorer/schema'
import type { CodeLocation, Platform, ProductArea } from '@dependency-explorer/schema'
import { z } from 'zod'

const PLATFORM_COLOR = '#475569'

function loc(repo: string, platform: Platform, ...globs: string[]): CodeLocation {
  return { repo, platform, globs }
}

const areas: ProductArea[] = z.array(ProductAreaSchema).parse([
  {
    id: 'planning',
    name: 'Planning',
    kind: 'product',
    color: '#6366f1',
    description: 'Week, day and month schedules — shifts, templates, conflicts, swaps and publication',
    codeLocations: [
      loc('skello-app', 'monolith',
        'app/controllers/v3/api/plannings/**', 'app/controllers/v3/api/v1/**', 'app/controllers/v3/api/planning_templates_controller.rb',
        'app/services/v3/shifts/**', 'app/services/plannings/**', 'app/services/planning_templates/**', 'app/services/planning_duplicator.rb',
        'app/services/conflict_management/**', 'app/models/shift.rb', 'app/models/poste.rb', 'app/models/planning_template*.rb',
        'app/models/event.rb', 'app/models/popular_shift.rb', 'app/models/shift_swap.rb', 'app/models/weekly_option*.rb',
        'app/controllers/v3/api/weekly_options_controller.rb', 'app/services/v3/weekly_options/**', 'app/services/planning_notifier.rb'),
      loc('skello-app-front', 'web',
        'apps/vue-app/src/plannings/**', 'apps/base-app/src/routes/_authenticated/shops/$shopId/plannings/**',
        'apps/base-app/src/routes/_authenticated/shops/$shopId/templates/**'),
      loc('skello-mobile', 'mobile', 'src/screens/Planning/**', 'src/modules/planning/**', 'src/modules/shifts/**'),
      loc('svc-shifts', 'backend', '**'),
      loc('svc-bff-planning', 'backend', '**'),
      loc('svc-events', 'backend', '**'),
    ],
    readingPath: [
      { flowId: 'planning-page-load', why: "What the planning screen loads and in which order" },
      { flowId: 'shift-creation', why: "The core write and the shift callback group it fires" },
      { flowId: 'shift-update', why: "How edits propagate to counters and replicas" },
      { flowId: 'shift-publication', why: "How employees get notified of their planning" },
      { flowId: 'week-copy', why: "Bulk creation and its sync/async split" },
      { flowId: 'planning-period-lock', why: "How a period is locked against edits" }
    ],
    glossary: [
      {"term": "Shift", "definition": "A scheduled block of work for one employee on one poste in one shop; also carries absences (an absence is a shift with an absence type).", "anchor": {"repo": "skello-app", "path": "app/models/shift.rb", "symbol": "Shift"}},
      {"term": "Poste", "definition": "A position (role) in a shop that shifts are planned on — the colour-coded rows of the planning.", "anchor": {"repo": "skello-app", "path": "app/models/poste.rb", "symbol": "Poste"}},
      {"term": "Planning template", "definition": "A reusable day or week of template shifts a manager applies to a planning.", "anchor": {"repo": "skello-app", "path": "app/models/planning_template.rb", "symbol": "PlanningTemplate"}},
      {"term": "Planning event", "definition": "A shop-level calendar event shown on the planning (opening, inventory, promotion).", "anchor": {"repo": "skello-app", "path": "app/models/event.rb", "symbol": "Event"}},
      {"term": "Popular shift", "definition": "A frequently used shift time-slot per poste, offered as a shortcut when creating shifts.", "anchor": {"repo": "skello-app", "path": "app/models/popular_shift.rb", "symbol": "PopularShift"}},
      {"term": "Weekly option", "definition": "Per-shop, per-week planning state — publication and period lock — with its publication history.", "anchor": {"repo": "skello-app", "path": "app/models/weekly_option.rb", "symbol": "WeeklyOption"}}
    ],
  },
  {
    id: 'automatic-scheduling',
    name: 'Automatic scheduling',
    kind: 'product',
    color: '#8b5cf6',
    description: 'Automatic schedule generation — staff needs, competencies, scheduling rules, replacements',
    codeLocations: [
      loc('skello-app', 'monolith',
        'app/controllers/v3/api/automatic_planning/**', 'app/controllers/v3/api/automatic_scheduling/**',
        'app/services/automatic_planning_rules/**', 'app/models/automatic_planning_*.rb'),
      loc('svc-automatic-scheduling', 'backend', '**'),
    ],
    readingPath: [
      { flowId: 'auto-planning-generation', why: "An automatic scheduling run end to end" },
      { flowId: 'shift-replacement-search', why: "How replacements are found for an uncovered shift" }
    ],
    glossary: [
      {"term": "Automatic planning rule", "definition": "A shop-level constraint the automatic scheduler applies when generating a planning.", "anchor": {"repo": "skello-app", "path": "app/models/automatic_planning_rule.rb", "symbol": "AutomaticPlanningRule"}},
      {"term": "Competency", "definition": "An employee's ability to work a given poste, used by the scheduler to assign shifts.", "anchor": {"repo": "skello-app", "path": "app/models/automatic_planning_competency.rb", "symbol": "AutomaticPlanningCompetency"}}
    ],
  },
  {
    id: 'workload-forecasting',
    name: 'Workload & forecasting',
    kind: 'product',
    color: '#a855f7',
    description: 'Predictive turnover and POS-driven staffing — the workload plan',
    codeLocations: [
      loc('skello-app', 'monolith',
        'app/controllers/v3/api/integrations/**', 'app/services/pos_softwares/**',
        'app/models/week_planning_prevision*.rb', 'app/models/predicted_shift.rb'),
      loc('svc-workload-plan', 'backend', '**'),
      loc('svc-pos', 'backend', '**'),
      loc('svc-intelligence', 'backend', '**'),
    ],
    readingPath: [
      { flowId: 'workload-plan-consultation', why: "How the workload plan is read" },
      { flowId: 'workload-plan-creation', why: "How the forecast is computed" },
      { flowId: 'pos-revenue-ingestion', why: "Where the revenue behind the forecast comes from" }
    ],
    glossary: [
      {"term": "Week planning prevision", "definition": "The forecast staffing need of a shop week, computed from a template or from revenue.", "anchor": {"repo": "skello-app", "path": "app/models/week_planning_prevision.rb", "symbol": "WeekPlanningPrevision"}},
      {"term": "Predicted shift", "definition": "A shift suggested by the forecast for a poste, ahead of real scheduling.", "anchor": {"repo": "skello-app", "path": "app/models/predicted_shift.rb", "symbol": "PredictedShift"}}
    ],
  },
  {
    id: 'time-attendance',
    name: 'Time & attendance',
    kind: 'product',
    color: '#f59e0b',
    description: 'Badging and clock-in/out on tablet and mobile, matched against shifts',
    codeLocations: [
      loc('skello-app', 'monolith',
        'app/controllers/v3/api/badgings/**', 'app/services/badgings/**', 'app/services/punch_clock/**',
        'app/services/punch_clock_settings/**', 'app/models/badging*.rb', 'app/models/punch_clock_*.rb'),
      loc('skello-app-front', 'web', 'apps/vue-app/src/badgings/**', 'apps/vue-app/src/timeclock_onboarding/**'),
      loc('skello-mobile', 'mobile', 'src/screens/PunchClock/**', 'src/modules/punchClock/**'),
      loc('skello-punchclock', 'tablet', '**'),
      loc('svc-punch', 'backend', '**'),
    ],
    readingPath: [
      { flowId: 'employee-clock-in', why: "The offline-first tablet clock-in path" },
      { flowId: 'mobile-clock-in', why: "Clock-in from the mobile app" },
      { flowId: 'badging-review', why: "How badgings meet shifts for validation" },
      { flowId: 'punchclock-device-setup', why: "How a tablet is registered to a shop" }
    ],
    glossary: [
      {"term": "Badging", "definition": "A clock-in/clock-out record of an employee, matched against planned shifts for validation.", "anchor": {"repo": "skello-app", "path": "app/models/badging.rb", "symbol": "Badging"}},
      {"term": "Punch clock device", "definition": "A registered tablet running the punch-clock app for one shop.", "anchor": {"repo": "skello-app", "path": "app/models/punch_clock_device.rb", "symbol": "PunchClockDevice"}},
      {"term": "Punch clock setting", "definition": "A shop-level option of the time clock (rounding, breaks, photo, PIN rules).", "anchor": {"repo": "skello-app", "path": "app/models/punch_clock_setting.rb", "symbol": "PunchClockSetting"}}
    ],
  },
  {
    id: 'leave-requests',
    name: 'Leave & requests',
    kind: 'product',
    color: '#10b981',
    description: 'Leave requests, availabilities and swap requests, with their approval workflows',
    codeLocations: [
      loc('skello-app', 'monolith',
        'app/controllers/v3/api/absences_controller.rb', 'app/controllers/v3/api/leave_requests_controller.rb',
        'app/controllers/v3/api/availabilities_controller.rb', 'app/controllers/v3/api/pending_requests_controller.rb',
        'app/models/leave_request.rb', 'app/models/availability.rb', 'app/models/shop_absence_config.rb'),
      loc('skello-app-front', 'web', 'apps/vue-app/src/requests/**'),
      loc('skello-mobile', 'mobile',
        'src/screens/Requests/**', 'src/screens/LeaveRequests/**', 'src/modules/leaveRequests/**', 'src/modules/requests/**'),
      loc('svc-requests', 'backend', '**'),
    ],
    readingPath: [
      { flowId: 'leave-request-lifecycle', why: "A leave request from submission to decision" },
      { flowId: 'leave-request-approval', why: "How approval writes absences into the planning" },
      { flowId: 'leave-request-cancellation', why: "What cancelling an approved leave undoes" },
      { flowId: 'availability-submission', why: "How employees declare availabilities" }
    ],
    glossary: [
      {"term": "Leave request", "definition": "An employee's request for an absence over a period, approved or refused by a manager.", "anchor": {"repo": "skello-app", "path": "app/models/leave_request.rb", "symbol": "LeaveRequest"}},
      {"term": "Availability", "definition": "An employee's declared availability or unavailability for a slot, optionally submitted for approval.", "anchor": {"repo": "skello-app", "path": "app/models/availability.rb", "symbol": "Availability"}},
      {"term": "Shift swap", "definition": "A request to hand a shift from one employee to another, with optional manager approval.", "anchor": {"repo": "skello-app", "path": "app/models/shift_swap.rb", "symbol": "ShiftSwap"}},
      {"term": "Absence config", "definition": "A shop's configuration of which absence types exist and how they count.", "anchor": {"repo": "skello-app", "path": "app/models/shop_absence_config.rb", "symbol": "ShopAbsenceConfig"}}
    ],
  },
  {
    id: 'employees-hr',
    name: 'Employees & HR file',
    kind: 'product',
    color: '#3b82f6',
    description: 'Employee records, contracts and amendments, HR file, DPAE and HRIS sync',
    codeLocations: [
      loc('skello-app', 'monolith',
        'app/controllers/v3/api/users/**', 'app/controllers/v3/api/employees/**', 'app/controllers/v3/api/contracts_controller.rb',
        'app/controllers/v3/api/contract_amendments_controller.rb', 'app/controllers/v3/api/dpae_deposits_controller.rb',
        'app/controllers/v3/api/staff_registers_controller.rb', 'app/controllers/v3/api/users_controller.rb', 'app/services/employees/**',
        'app/services/v3/users/**', 'app/jobs/archive_*_job.rb', 'app/models/user*.rb',
        'app/models/membership.rb', 'app/models/contract*.rb', 'app/models/dpae_deposit.rb'),
      loc('skello-app-front', 'web', 'apps/vue-app/src/employees/**', 'apps/vue-app/src/users/**', 'apps/vue-app/src/profile/**'),
      loc('skello-mobile', 'mobile', 'src/screens/UserSpace/**', 'src/screens/HrModal/**', 'src/modules/employees/**', 'src/modules/contracts/**'),
      loc('svc-employees', 'backend', '**'),
      loc('svc-hris', 'backend', '**'),
    ],
    readingPath: [
      { flowId: 'employee-onboarding', why: "How an employee is created and invited" },
      { flowId: 'contract-amendment', why: "How a contract changes over time" },
      { flowId: 'employee-hris-sync', why: "How employees are pulled from HRIS tools" },
      { flowId: 'employee-archival', why: "What archiving an employee touches" }
    ],
    glossary: [
      {"term": "User", "definition": "A person with a Skello account — employee, manager or administrator.", "anchor": {"repo": "skello-app", "path": "app/models/user.rb", "symbol": "User"}},
      {"term": "Membership", "definition": "The link between a user and a shop, carrying the user's default poste there.", "anchor": {"repo": "skello-app", "path": "app/models/membership.rb", "symbol": "Membership"}},
      {"term": "Contract", "definition": "An employee's employment contract — type, hours, wage — with its amendments and bonuses.", "anchor": {"repo": "skello-app", "path": "app/models/contract.rb", "symbol": "Contract"}},
      {"term": "Contract amendment", "definition": "A dated change to a contract (hours, schedule, wage).", "anchor": {"repo": "skello-app", "path": "app/models/contract_amendment.rb", "symbol": "ContractAmendment"}},
      {"term": "DPAE deposit", "definition": "The pre-hiring declaration of a contract sent to URSSAF, with its deposit status.", "anchor": {"repo": "skello-app", "path": "app/models/dpae_deposit.rb", "symbol": "DpaeDeposit"}}
    ],
  },
  {
    id: 'counters-labour-law',
    name: 'Counters & labour law',
    kind: 'product',
    color: '#ef4444',
    description: 'Paid leave, RTT, RCR and annualisation counters, conventions, alerts and labour-law rules',
    codeLocations: [
      loc('skello-app', 'monolith',
        'app/controllers/v3/api/rcr*.rb', 'app/controllers/v3/api/paid_leaves_counters_controller.rb',
        'app/controllers/v3/api/labour_laws_controller.rb', 'app/controllers/v3/api/shops/**', 'app/services/labour_law/**',
        'app/services/paid_leaves_counters/**', 'app/services/rcr_counters/**', 'app/services/hours_counters/**',
        'app/services/conventions/**', 'app/models/paid_leaves_counter.rb', 'app/models/rcr_counter.rb', 'app/models/convention.rb',
        'app/models/shop_labour_law.rb', 'app/models/alert.rb', 'app/models/shop_annualization_config.rb'),
      loc('superadmin', 'superadmin',
        'src/pages/LabourLaws/**', 'src/pages/LegalRules/**', 'src/pages/DefaultSettings/**', 'src/pages/TrackersSettings/**'),
      loc('svc-labour-laws', 'backend', '**'),
      loc('svc-trackers', 'backend', '**'),
    ],
    readingPath: [],
    glossary: [
      {"term": "Paid leaves counter", "definition": "An employee's acquired and taken paid-leave balance.", "anchor": {"repo": "skello-app", "path": "app/models/paid_leaves_counter.rb", "symbol": "PaidLeavesCounter"}},
      {"term": "RCR counter", "definition": "An employee's compensatory rest (repos compensateur de remplacement) balance.", "anchor": {"repo": "skello-app", "path": "app/models/rcr_counter.rb", "symbol": "RcrCounter"}},
      {"term": "Convention", "definition": "The collective agreement a shop applies — overtime, night, Sunday majoration slices and alerts.", "anchor": {"repo": "skello-app", "path": "app/models/convention.rb", "symbol": "Convention"}},
      {"term": "Shop labour law", "definition": "A shop's labour-law settings derived from its convention and country.", "anchor": {"repo": "skello-app", "path": "app/models/shop_labour_law.rb", "symbol": "ShopLabourLaw"}},
      {"term": "Annualisation", "definition": "A shop's annualised working-time configuration.", "anchor": {"repo": "skello-app", "path": "app/models/shop_annualization_config.rb", "symbol": "ShopAnnualizationConfig"}},
      {"term": "Alert", "definition": "A labour-law alert rule (rest, max hours, breaks) raised on the planning.", "anchor": {"repo": "skello-app", "path": "app/models/alert.rb", "symbol": "Alert"}}
    ],
  },
  {
    id: 'documents-esignature',
    name: 'Documents & e-signature',
    kind: 'product',
    color: '#14b8a6',
    description: 'Document generation, folders, sharing, payslips and electronic signature',
    codeLocations: [
      loc('skello-app', 'monolith',
        'app/controllers/v3/api/request_esignatures_controller.rb', 'app/services/esignatures/**', 'app/models/text_document*.rb'),
      loc('skello-app-front', 'web', 'apps/base-app/src/routes/_authenticated/shops/$shopId/documents/**'),
      loc('skello-mobile', 'mobile',
        'src/screens/Documents/**', 'src/modules/documents/**', 'src/modules/folders/**', 'src/modules/signatures/**'),
      loc('svc-documents-v2', 'backend', '**'),
      loc('svc-documents-esignature', 'backend', '**'),
    ],
    readingPath: [
      { flowId: 'document-generation-esignature', why: "Generating a document and sending it for signature" },
      { flowId: 'document-share', why: "How documents are shared with employees" },
      { flowId: 'payslip-dispatch', why: "How payslips are split and distributed" }
    ],
    glossary: [
      {"term": "Text document", "definition": "A document generated for an employee from a template, optionally sent for e-signature.", "anchor": {"repo": "skello-app", "path": "app/models/text_document.rb", "symbol": "TextDocument"}},
      {"term": "Document template", "definition": "An organisation's template with variables used to generate documents.", "anchor": {"repo": "skello-app", "path": "app/models/text_document_template.rb", "symbol": "TextDocumentTemplate"}}
    ],
  },
  {
    id: 'payroll-reports',
    name: 'Payroll & reports',
    kind: 'product',
    color: '#f97316',
    description: 'Payroll report, report rules and exports to payroll software',
    codeLocations: [
      loc('skello-app', 'monolith',
        'app/controllers/v3/api/reports_controller.rb', 'app/controllers/v3/api/primes_controller.rb',
        'app/services/report/**', 'app/jobs/report/**', 'app/services/payroll/**', 'app/models/prime.rb', 'app/models/report_comment.rb'),
      loc('skello-app-front', 'web', 'apps/vue-app/src/reports/**'),
      loc('svc-payroll', 'backend', '**'),
      loc('svc-reports', 'backend', '**'),
    ],
    readingPath: [
      { flowId: 'payroll-export', why: "How payroll data leaves Skello" },
      { flowId: 'planning-report-export', why: "How the payroll report is exported to Excel" }
    ],
    glossary: [
      {"term": "Prime", "definition": "A bonus attached to a contract for a period, exported with payroll.", "anchor": {"repo": "skello-app", "path": "app/models/prime.rb", "symbol": "Prime"}},
      {"term": "Report comment", "definition": "A manager's per-contract comment on the payroll report.", "anchor": {"repo": "skello-app", "path": "app/models/report_comment.rb", "symbol": "ReportComment"}}
    ],
  },
  {
    id: 'analytics',
    name: 'Analytics & dashboards',
    kind: 'product',
    color: '#ec4899',
    description: 'Home dashboard, analytics dashboard and KPIs',
    codeLocations: [
      loc('skello-app', 'monolith',
        'app/controllers/v3/api/dashboards_controller.rb', 'app/services/dashboard/**', 'app/models/labor_cost.rb',
        'app/models/planning_hours_data.rb'),
      loc('skello-app-front', 'web', 'apps/vue-app/src/analytics_dashboard/**', 'apps/vue-app/src/home_dashboard/**'),
      loc('skello-mobile', 'mobile', 'src/screens/Home/**'),
      loc('svc-kpis', 'backend', '**'),
      loc('svc-kpis-v2', 'backend', '**'),
      loc('svc-bff', 'backend', '**'),
    ],
    readingPath: [
      { flowId: 'analytics-dashboard-load', why: "What the analytics dashboard loads" },
      { flowId: 'bff-dashboard-load', why: "The KPI aggregation behind the home dashboard" }
    ],
    glossary: [
      {"term": "Labor cost", "definition": "A shop's labour-cost data used by dashboards.", "anchor": {"repo": "skello-app", "path": "app/models/labor_cost.rb", "symbol": "LaborCost"}},
      {"term": "Planning hours data", "definition": "Aggregated planned hours per employee and period, feeding dashboards and counters.", "anchor": {"repo": "skello-app", "path": "app/models/planning_hours_data.rb", "symbol": "PlanningHoursData"}}
    ],
  },
  {
    id: 'missions',
    name: 'Missions',
    kind: 'product',
    color: '#84cc16',
    description: 'Missions and tasks assigned to employees',
    codeLocations: [
      loc('skello-app', 'monolith', 'app/controllers/v3/api/missions_controller.rb'),
      loc('skello-app-front', 'web', 'apps/vue-app/src/missions/**'),
      loc('skello-mobile', 'mobile', 'src/modules/missions/**'),
      loc('svc-shops', 'backend', '**'),
    ],
    readingPath: [
      { flowId: 'mission-management', why: "Creating and assigning missions" }
    ],
    glossary: [
      {"term": "Mission", "definition": "A task or assignment given to employees, stored by svc-shops.", "anchor": {"repo": "svc-shops", "path": "src/Entity/MissionEntity.ts", "symbol": "MissionEntitySchema"}}
    ],
  },
  {
    id: 'hiring',
    name: 'Hiring',
    kind: 'product',
    color: '#06b6d4',
    description: 'Recruitment through the JOIN applicant tracking system',
    codeLocations: [
      loc('svc-hiring', 'backend', '**'),
      loc('skello-app', 'monolith', 'app/services/join/**'),
    ],
    readingPath: [],
    glossary: [
      {"term": "JOIN company", "definition": "The JOIN applicant-tracking account provisioned for a Skello organisation.", "anchor": {"repo": "svc-hiring", "path": "src/Entity/JoinCompanyStatusEntity.ts", "symbol": "createJoinCompanyStatusEntity"}}
    ],
  },
  {
    id: 'org-admin',
    name: 'Organisation & shop admin',
    kind: 'product',
    color: '#64748b',
    description: 'Organisations, shops, clusters, teams, positions and licenses',
    codeLocations: [
      loc('skello-app', 'monolith',
        'app/controllers/v3/api/shops_controller.rb', 'app/controllers/v3/api/organisations/**', 'app/controllers/v3/api/cluster_*.rb',
        'app/controllers/v3/api/teams_controller.rb', 'app/controllers/v3/api/postes_controller.rb',
        'app/controllers/v3/api/licenses_controller.rb', 'app/services/cluster_nodes/**', 'app/services/licenses/**', 'app/services/v3/organisations/**',
        'app/models/organisation*.rb', 'app/models/shop*.rb', 'app/models/cluster_node.rb', 'app/models/team*.rb',
        'app/models/license.rb', 'app/models/user_license.rb'),
      loc('skello-app-front', 'web',
        'apps/vue-app/src/shop_settings/**', 'apps/vue-app/src/organisation_settings/**', 'apps/vue-app/src/organisation_selector/**',
        'apps/base-app/src/routes/_authenticated/shops/$shopId/settings/**'),
      loc('skello-mobile', 'mobile',
        'src/screens/OrganisationSelector/**', 'src/screens/AppLoader/**', 'src/modules/shops/**', 'src/modules/config/**',
        'src/modules/currentUser/**', 'src/context/orgSwitchContext.tsx'),
      loc('superadmin', 'superadmin', 'src/pages/Organisation*/**', 'src/pages/Shop*/**', 'src/pages/User*/**', 'src/pages/AccountCreation/**'),
      loc('svc-modularisation', 'backend', '**'),
    ],
    readingPath: [
      { flowId: 'org-onboarding', why: "How an organisation and its first shop are created" },
      { flowId: 'mobile-app-bootstrap', why: "How the mobile app loads user, shop and config context" }
    ],
    glossary: [
      {"term": "Organisation", "definition": "A customer account grouping shops, teams, licenses and billing.", "anchor": {"repo": "skello-app", "path": "app/models/organisation.rb", "symbol": "Organisation"}},
      {"term": "Shop", "definition": "An establishment where employees work and plannings are made.", "anchor": {"repo": "skello-app", "path": "app/models/shop.rb", "symbol": "Shop"}},
      {"term": "Cluster node", "definition": "A node of the organisation's hierarchy grouping shops for multi-site management.", "anchor": {"repo": "skello-app", "path": "app/models/cluster_node.rb", "symbol": "ClusterNode"}},
      {"term": "Team", "definition": "A group of employees inside a shop, with its own schedules.", "anchor": {"repo": "skello-app", "path": "app/models/team.rb", "symbol": "Team"}},
      {"term": "License", "definition": "A permission profile (manager, employee, admin…) assigned to users across the organisation.", "anchor": {"repo": "skello-app", "path": "app/models/license.rb", "symbol": "License"}}
    ],
  },
  {
    id: 'billing',
    name: 'Billing & subscription',
    kind: 'product',
    color: '#eab308',
    description: 'Self-serve signup, subscription, billing, upsell and churn',
    codeLocations: [
      loc('skello-app', 'monolith',
        'app/controllers/v3/api/billing_automation/**', 'app/controllers/v3/api/onboarding/**', 'app/controllers/v3/api/webhooks/**',
        'app/controllers/v3/api/v0/**', 'app/controllers/v3/api/sepa_controller.rb', 'app/controllers/v3/api/billing_infos_controller.rb',
        'app/controllers/v3/api/upsells_controller.rb', 'app/controllers/v3/api/self_serve_controller.rb', 'app/services/billing/**',
        'app/services/invoices/**', 'app/services/salesforce_update/**', 'app/models/billing_info.rb', 'app/models/pack_offer.rb',
        'app/models/prospect.rb', 'app/models/stripe_*.rb'),
      loc('skello-app-front', 'web', 'apps/vue-app/src/onboarding/**', 'apps/vue-app/src/admin_onboarding/**'),
      loc('superadmin', 'superadmin', 'src/pages/Invoices/**'),
      loc('svc-billing-automation', 'backend', '**'),
      loc('svc-enrollment', 'backend', '**'),
    ],
    readingPath: [
      { flowId: 'self-serve-signup', why: "A prospect signing up on their own" },
      { flowId: 'subscription-upgrade', why: "Moving to a higher pack" },
      { flowId: 'assistant-freemium-credits', why: "How assistant credits are checked and spent" }
    ],
    glossary: [
      {"term": "Billing info", "definition": "A shop or organisation's payment details (SEPA, card) and charges.", "anchor": {"repo": "skello-app", "path": "app/models/billing_info.rb", "symbol": "BillingInfo"}},
      {"term": "Pack offer", "definition": "A commercial bundle of Skello features a customer subscribes to.", "anchor": {"repo": "skello-app", "path": "app/models/pack_offer.rb", "symbol": "PackOffer"}},
      {"term": "Prospect", "definition": "A sales lead going through signup and onboarding steps before becoming a customer.", "anchor": {"repo": "skello-app", "path": "app/models/prospect.rb", "symbol": "Prospect"}}
    ],
  },
  {
    id: 'auth-identity',
    name: 'Auth & identity',
    kind: 'platform',
    color: PLATFORM_COLOR,
    description: 'Cross-cutting capability — authentication, sessions and user identity',
    codeLocations: [
      loc('svc-users', 'backend', '**'),
      loc('skello-app', 'monolith', 'app/services/auth/**'),
      loc('skello-mobile', 'mobile', 'src/screens/SignIn/**', 'src/plugins/clients/AuthClient/**'),
    ],
    readingPath: [],
    glossary: [],
  },
  {
    id: 'notifications',
    name: 'Notifications',
    kind: 'platform',
    color: PLATFORM_COLOR,
    description: 'Cross-cutting capability — email, push, SMS and real-time websocket delivery',
    codeLocations: [
      loc('svc-communications-v2', 'backend', '**'),
      loc('svc-websockets', 'backend', '**'),
      loc('svc-websockets-v2', 'backend', '**'),
      loc('skello-app', 'monolith', 'app/services/notifications/**'),
      loc('skello-mobile', 'mobile', 'src/plugins/skPushNotifications/**'),
    ],
    readingPath: [],
    glossary: [],
  },
  {
    id: 'search',
    name: 'Search',
    kind: 'platform',
    color: PLATFORM_COLOR,
    description: 'Cross-cutting capability — read replicas and search fed by CDC',
    codeLocations: [loc('svc-search', 'backend', '**')],
    readingPath: [],
    glossary: [],
  },
  {
    id: 'feature-flags',
    name: 'Feature flags',
    kind: 'platform',
    color: PLATFORM_COLOR,
    description: 'Cross-cutting capability — product and dev flags, canary releases',
    codeLocations: [
      loc('svc-feature-flags', 'backend', '**'),
      loc('superadmin', 'superadmin', 'src/pages/FeatureFlags/**'),
      loc('skello-app', 'monolith', 'app/services/features/**', 'app/services/features_states/**'),
      loc('skello-mobile', 'mobile', 'src/modules/featureFlags/**'),
    ],
    readingPath: [],
    glossary: [],
  },
  {
    id: 'bff',
    name: 'Backends-for-frontend',
    kind: 'platform',
    color: PLATFORM_COLOR,
    description: 'Cross-cutting capability — aggregation APIs shaped for the clients',
    codeLocations: [loc('svc-bff', 'backend', '**'), loc('svc-bff-planning', 'backend', '**')],
    readingPath: [],
    glossary: [],
  },
  {
    id: 'assistant',
    name: 'Assistant',
    kind: 'platform',
    color: PLATFORM_COLOR,
    description: 'Cross-cutting capability — the conversational Skello assistant',
    codeLocations: [loc('svc-skello-assistant', 'backend', '**')],
    readingPath: [],
    glossary: [],
  },
])

export default areas
