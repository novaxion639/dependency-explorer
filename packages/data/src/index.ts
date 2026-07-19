import { ConnectivityMapSchema, DiscoveredOverlaySchema } from '@dependency-explorer/schema'
import type { ConnectivityMap } from '@dependency-explorer/schema'
import connections from './connections'
import teams from './teams'
import domains from './domains'
import rules from './rules'
import discoveredJson from './generated/discovered.json'

import svc_events from './services/svc-events'
import svc_communications_v2 from './services/svc-communications-v2'
import svc_employees from './services/svc-employees'
import svc_documents_v2 from './services/svc-documents-v2'
import svc_punch from './services/svc-punch'
import svc_shops from './services/svc-shops'
import svc_search from './services/svc-search'
import svc_requests from './services/svc-requests'
import svc_billing_automation from './services/svc-billing-automation'
import svc_hiring from './services/svc-hiring'
import svc_hris from './services/svc-hris'
import svc_intelligence from './services/svc-intelligence'
import svc_kpis from './services/svc-kpis'
import svc_kpis_v2 from './services/svc-kpis-v2'
import svc_trackers from './services/svc-trackers'
import svc_bff from './services/svc-bff'
import svc_bff_planning from './services/svc-bff-planning'
import svc_automatic_scheduling from './services/svc-automatic-scheduling'
import svc_modularisation from './services/svc-modularisation'
import svc_shifts from './services/svc-shifts'
import svc_reports from './services/svc-reports'
import svc_enrollment from './services/svc-enrollment'
import svc_users from './services/svc-users'
import svc_labour_laws from './services/svc-labour-laws'
import svc_pos from './services/svc-pos'
import svc_skello_assistant from './services/svc-skello-assistant'
import svc_documents_esignature from './services/svc-documents-esignature'
import svc_workload_plan from './services/svc-workload-plan'
import svc_feature_flags from './services/svc-feature-flags'
import svc_payroll from './services/svc-payroll'
import svc_websockets from './services/svc-websockets'
import svc_websockets_v2 from './services/svc-websockets-v2'
import superadmin from './services/superadmin'
import skello_app from './services/skello-app'
import skello_app_front from './services/skello-app-front'
import skello_mobile from './services/skello-mobile'
import skello_punchclock from './services/skello-punchclock'

import assistant_chat from './flows/assistant-chat'
import analytics_dashboard_load from './flows/analytics-dashboard-load'
import availability_submission from './flows/availability-submission'
import badging_review from './flows/badging-review'
import payslip_dispatch from './flows/payslip-dispatch'
import employee_clock_in from './flows/employee-clock-in'
import mobile_clock_in from './flows/mobile-clock-in'
import mobile_app_bootstrap from './flows/mobile-app-bootstrap'
import mobile_planning_management from './flows/mobile-planning-management'
import mobile_shift_swap_request from './flows/mobile-shift-swap-request'
import mobile_documents_payslips from './flows/mobile-documents-payslips'
import punchclock_device_setup from './flows/punchclock-device-setup'
import self_serve_signup from './flows/self-serve-signup'
import subscription_upgrade from './flows/subscription-upgrade'
import employee_onboarding from './flows/employee-onboarding'
import payroll_export from './flows/payroll-export'
import leave_request_lifecycle from './flows/leave-request-lifecycle'
import document_generation_esignature from './flows/document-generation-esignature'
import auto_planning_generation from './flows/auto-planning-generation'
import employee_hris_sync from './flows/employee-hris-sync'
import bff_dashboard_load from './flows/bff-dashboard-load'
import shift_creation from './flows/shift-creation'
import shift_deletion from './flows/shift-deletion'
import shift_update from './flows/shift-update'
import shift_publication from './flows/shift-publication'
import leave_request_cancellation from './flows/leave-request-cancellation'
import workload_plan_consultation from './flows/workload-plan-consultation'
import leave_request_approval from './flows/leave-request-approval'
import workload_plan_creation from './flows/workload-plan-creation'
import shift_replacement_search from './flows/shift-replacement-search'
import planning_page_load from './flows/planning-page-load'
import week_copy from './flows/week-copy'
import planning_report_export from './flows/planning-report-export'
import planning_period_lock from './flows/planning-period-lock'
import absence_creation from './flows/absence-creation'
import shift_bulk_erase from './flows/shift-bulk-erase'
import shift_swap from './flows/shift-swap'
import planning_event_management from './flows/planning-event-management'
import planning_template from './flows/planning-template'

// ── Discovered overlay merge (ADR-0004) ──────────────────────────────────────
// Machine-verified facts from `pnpm discover:apply` enrich the manual layer:
// repoUrl/teamId fill in on services, verification stamps on connections.
// The overlay never adds or removes entities — only annotates existing ones.

const overlay = DiscoveredOverlaySchema.parse(discoveredJson)
const verifiedOn = overlay.generatedAt.slice(0, 10)

function enrichServices(services: unknown[]): unknown[] {
  const endpointStamps = overlay.endpoints ?? {}
  return (services as Array<Record<string, unknown>>).map(svc => {
    const facts = overlay.services[svc.name as string]
    const endpoints = (svc.endpoints as Array<Record<string, unknown>>).map(ep => {
      const stamp = endpointStamps[`${svc.name}#${ep.id}`]
      return stamp ? { ...ep, provenance: { source: 'discovered', ...stamp } } : ep
    })
    if (!facts) return { ...svc, endpoints }
    return {
      ...svc,
      endpoints,
      repoUrl: facts.repoUrl ?? svc.repoUrl,
      teamId: facts.teamId ?? svc.teamId,
      githubTeams: facts.githubTeams ?? svc.githubTeams,
      recurringTasks: facts.recurringTasks?.map(t => ({
        ...t,
        provenance: { source: 'discovered', lastVerified: verifiedOn, evidence: 'serverless schedule event' },
      })) ?? svc.recurringTasks,
      provenance: {
        source: 'discovered',
        lastVerified: verifiedOn,
        evidence: 'repo scan (package.json + CODEOWNERS)',
      },
    }
  })
}

function enrichConnections(conns: typeof connections): typeof connections {
  return conns.map(conn => {
    const stamp = overlay.connections[`${conn.from}→${conn.to}`]
    if (!stamp) return conn
    return { ...conn, provenance: { source: 'discovered' as const, ...stamp } }
  })
}

export const connectivityMap: ConnectivityMap = ConnectivityMapSchema.parse({
  services: enrichServices([
  svc_events,
  svc_communications_v2,
  svc_employees,
  svc_documents_v2,
  svc_punch,
  svc_shops,
  svc_search,
  svc_requests,
  svc_billing_automation,
  svc_hiring,
  svc_hris,
  svc_intelligence,
  svc_kpis,
  svc_kpis_v2,
  svc_trackers,
  svc_bff,
  svc_bff_planning,
  svc_automatic_scheduling,
  svc_modularisation,
  svc_shifts,
  svc_reports,
  svc_enrollment,
  svc_users,
  svc_labour_laws,
  svc_pos,
  svc_skello_assistant,
  svc_documents_esignature,
  svc_workload_plan,
  svc_feature_flags,
  svc_payroll,
  svc_websockets,
  svc_websockets_v2,
  superadmin,
  skello_app,
  skello_app_front,
  skello_mobile,
  skello_punchclock,
  ]),
  connections: enrichConnections(connections),
  flows: [
  assistant_chat,
  analytics_dashboard_load,
  availability_submission,
  badging_review,
  payslip_dispatch,
  employee_clock_in,
  mobile_clock_in,
  mobile_app_bootstrap,
  mobile_planning_management,
  mobile_shift_swap_request,
  mobile_documents_payslips,
  punchclock_device_setup,
  self_serve_signup,
  subscription_upgrade,
  employee_onboarding,
  payroll_export,
  leave_request_lifecycle,
  document_generation_esignature,
  auto_planning_generation,
  employee_hris_sync,
  bff_dashboard_load,
  shift_creation,
  shift_deletion,
  shift_update,
  shift_publication,
  leave_request_cancellation,
  workload_plan_consultation,
  leave_request_approval,
  workload_plan_creation,
  shift_replacement_search,
  planning_page_load,
  week_copy,
  planning_report_export,
  planning_period_lock,
  absence_creation,
  shift_bulk_erase,
  shift_swap,
  planning_event_management,
  planning_template,
  ],
  teams,
  domains,
  rules,
})

export * from '@dependency-explorer/schema'
export { getFlowDomains } from './flow-domains'
