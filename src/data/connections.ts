import { ServiceConnectionSchema } from './schemas'
import type { ServiceConnection, CommunicationType, Protocol, AuthType } from './schemas'
import { z } from 'zod'

/**
 * Infer communication details from the sdkPackage string.
 * Explicit values on the connection object take precedence.
 */
function inferCommunicationDefaults(pkg: string): {
  communicationType: CommunicationType
  protocol: Protocol
  authType: AuthType
} {
  if (pkg.includes('(SQS)') && !pkg.includes('HTTParty')) {
    return { communicationType: 'async', protocol: 'sqs', authType: 'iam-role' }
  }
  if (pkg.includes('(HTTParty)')) {
    return { communicationType: 'sync', protocol: 'rest', authType: 'internal' }
  }
  // Default: typed HTTP SDK clients
  return { communicationType: 'sync', protocol: 'rest', authType: 'jwt' }
}

const raw: ServiceConnection[] = z.array(ServiceConnectionSchema).parse([
  {
    "from": "svc-events",
    "to": "svc-communications-v2",
    "sdkPackage": "@skelloapp/svc-communications-v2-sdk",
    "description": "Publishes event notifications to employees via email/push",
    "usedEndpoints": [
      "bulk-create-high-priority-email-route",
      "bulk-create-low-priority-email-route",
      "bulk-create-high-priority-notification-route"
    ]
  },
  {
    "from": "svc-skello-assistant",
    "to": "svc-communications-v2",
    "sdkPackage": "@skelloapp/svc-communications-v2-sdk",
    "description": "Sends confirmation messages and summaries to users",
    "usedEndpoints": [
      "bulk-create-high-priority-email-route",
      "bulk-create-low-priority-email-route",
      "bulk-create-high-priority-notification-route"
    ]
  },
  {
    "from": "svc-billing-automation",
    "to": "svc-communications-v2",
    "sdkPackage": "@skelloapp/svc-communications-v2-sdk",
    "description": "Sends invoices, payment failures and subscription notifications",
    "usedEndpoints": [
      "bulk-create-high-priority-email-route",
      "bulk-create-low-priority-email-route",
      "bulk-create-high-priority-sms-route"
    ]
  },
  {
    "from": "svc-documents-v2",
    "to": "svc-communications-v2",
    "sdkPackage": "@skelloapp/svc-communications-v2-sdk",
    "description": "Notifies employees when a document is ready to sign",
    "usedEndpoints": [
      "bulk-create-high-priority-email-route",
      "bulk-create-low-priority-email-route",
      "bulk-create-high-priority-notification-route"
    ]
  },
  {
    "from": "svc-hris",
    "to": "svc-communications-v2",
    "sdkPackage": "@skelloapp/svc-communications-v2-sdk",
    "description": "Sends HRIS sync completion and mismatch alerts",
    "usedEndpoints": [
      "bulk-create-high-priority-email-route",
      "bulk-create-low-priority-email-route"
    ]
  },
  {
    "from": "svc-users",
    "to": "svc-communications-v2",
    "sdkPackage": "@skelloapp/svc-communications-v2-sdk",
    "description": "Sends welcome emails and password reset emails on user creation",
    "usedEndpoints": [
      "bulk-create-high-priority-email-route",
      "bulk-create-low-priority-email-route"
    ]
  },
  {
    "from": "svc-requests",
    "to": "svc-communications-v2",
    "sdkPackage": "@skelloapp/svc-communications-v2-sdk",
    "description": "Notifies employees of request approval/rejection",
    "usedEndpoints": [
      "bulk-create-high-priority-email-route",
      "bulk-create-low-priority-email-route",
      "bulk-create-high-priority-notification-route"
    ]
  },
  {
    "from": "svc-employees",
    "to": "svc-communications-v2",
    "sdkPackage": "@skelloapp/svc-communications-v2-sdk",
    "description": "Sends onboarding invitation emails to new employees",
    "usedEndpoints": [
      "bulk-create-high-priority-email-route",
      "bulk-create-low-priority-email-route"
    ]
  },
  {
    "from": "svc-intelligence",
    "to": "svc-documents-v2",
    "sdkPackage": "@skelloapp/svc-documents-v2-client",
    "description": "Fetches document content for AI processing and analysis",
    "usedEndpoints": [
      "api-bulk-send-signature-reminders",
      "api-bulk-send-reminders-from-filters"
    ]
  },
  {
    "from": "svc-communications-v2",
    "to": "svc-documents-v2",
    "sdkPackage": "@skelloapp/svc-documents-v2-client",
    "description": "Retrieves documents to attach to emails (e.g. payslips, contracts)",
    "usedEndpoints": [
      "api-bulk-send-signature-reminders",
      "api-bulk-send-reminders-from-filters"
    ]
  },
  {
    "from": "svc-skello-assistant",
    "to": "svc-documents-v2",
    "sdkPackage": "@skelloapp/svc-documents-v2-client",
    "description": "Fetches documents for AI analysis and answer grounding",
    "usedEndpoints": [
      "api-bulk-send-signature-reminders",
      "api-bulk-send-reminders-from-filters"
    ]
  },
  {
    "from": "svc-documents-esignature",
    "to": "svc-documents-v2",
    "sdkPackage": "@skelloapp/svc-documents-v2-client",
    "description": "Retrieves document file for e-signature provider and updates status after signing",
    "usedEndpoints": [
      "api-bulk-send-signature-reminders"
    ]
  },
  {
    "from": "svc-bff",
    "to": "svc-documents-v2",
    "sdkPackage": "@skelloapp/svc-documents-v2-client",
    "description": "Aggregates employee documents for the BFF document list view",
    "usedEndpoints": [
      "api-bulk-send-signature-reminders",
      "api-bulk-send-reminders-from-filters"
    ]
  },
  {
    "from": "svc-shops",
    "to": "svc-employees",
    "sdkPackage": "@skelloapp/svc-employees-client",
    "description": "Looks up employee details when building shop/team rosters",
    "usedEndpoints": [
      "api-get-employees",
      "api-get-employee"
    ]
  },
  {
    "from": "svc-hris",
    "to": "svc-employees",
    "sdkPackage": "@skelloapp/svc-employees-client",
    "description": "Syncs HRIS employee data into Skello employee records",
    "usedEndpoints": [
      "api-bulk-upsert-employees",
      "api-get-employee",
      "api-update-employee"
    ]
  },
  {
    "from": "svc-kpis-v2",
    "to": "svc-employees",
    "sdkPackage": "@skelloapp/svc-employees-client",
    "description": "Retrieves employee contract data (hours, costs) for KPI computation",
    "usedEndpoints": [
      "api-get-employees",
      "api-get-employee-contracts"
    ]
  },
  {
    "from": "svc-trackers",
    "to": "svc-search",
    "sdkPackage": "@skelloapp/svc-search-sdk",
    "description": "Indexes time tracker entries for project search",
    "usedEndpoints": []
  },
  {
    "from": "svc-shops",
    "to": "svc-search",
    "sdkPackage": "@skelloapp/svc-search-sdk",
    "description": "Indexes shop locations for global search",
    "usedEndpoints": []
  },
  {
    "from": "svc-kpis-v2",
    "to": "svc-search",
    "sdkPackage": "@skelloapp/svc-search-sdk",
    "description": "Indexes KPI snapshots for analytics search",
    "usedEndpoints": []
  },
  {
    "from": "svc-automatic-scheduling",
    "to": "svc-search",
    "sdkPackage": "@skelloapp/svc-search-sdk",
    "description": "Reads shifts and postes directly from svc-search's MongoDB over VPC for eligibility computation and replacement candidate ranking (no HTTP — ShiftRepository + PosteRepository direct DB access)",
    "usedEndpoints": []
  },
  {
    "from": "svc-bff-planning",
    "to": "svc-search",
    "sdkPackage": "@skelloapp/svc-search-sdk",
    "description": "Reads shifts and postes directly from svc-search's MongoDB over VPC (no HTTP — ShiftRepository + PosteRepository direct DB access)",
    "usedEndpoints": []
  },
  {
    "from": "svc-users",
    "to": "svc-punch",
    "sdkPackage": "@skelloapp/svc-punch-sdk",
    "description": "Provisions punch clock tokens for employees at login",
    "usedEndpoints": [
      "api-get-clocks-in-out",
      "api-create-clock-in-out"
    ]
  },
  {
    "from": "svc-skello-assistant",
    "to": "svc-billing-automation",
    "sdkPackage": "@skelloapp/svc-billing-automation-sdk",
    "description": "Answers billing and subscription questions from the assistant",
    "usedEndpoints": [
      "api-get-quote",
      "api-create-quote"
    ]
  },
  {
    "from": "svc-communications-v2",
    "to": "svc-events",
    "sdkPackage": "@skelloapp/svc-events-sdk",
    "description": "Publishes communication_sent and communication_failed events",
    "usedEndpoints": [
      "api-event-create"
    ]
  },
  {
    "from": "svc-employees",
    "to": "svc-events",
    "sdkPackage": "@skelloapp/svc-events-sdk",
    "description": "Publishes employee.created, employee.updated, employee.deleted domain events",
    "usedEndpoints": [
      "api-event-create"
    ]
  },
  {
    "from": "svc-requests",
    "to": "svc-events",
    "sdkPackage": "@skelloapp/svc-events-sdk",
    "description": "Publishes request.approved and request.rejected events for downstream consumers",
    "usedEndpoints": [
      "api-event-create"
    ]
  },
  {
    "from": "svc-hris",
    "to": "svc-shops",
    "sdkPackage": "@skelloapp/svc-shops-sdk",
    "description": "Maps HRIS cost centres to Skello shop locations during sync",
    "usedEndpoints": [
      "api-get-shops"
    ]
  },
  {
    "from": "svc-workload-plan",
    "to": "svc-kpis-v2",
    "sdkPackage": "@skelloapp/svc-kpis-v2-sdk",
    "description": "Fetches historical KPIs to train workload forecasting models",
    "usedEndpoints": [
      "api-get-activity-prediction-settings",
      "api-upsert-activity-prediction-settings"
    ]
  },
  {
    "from": "svc-bff",
    "to": "svc-kpis-v2",
    "sdkPackage": "@skelloapp/svc-kpis-v2-sdk",
    "description": "Includes KPI summary in the composite BFF dashboard response",
    "usedEndpoints": [
      "api-get-activity-prediction-settings",
      "api-upsert-activity-prediction-settings"
    ]
  },
  {
    "from": "svc-documents-v2",
    "to": "svc-intelligence",
    "sdkPackage": "@skelloapp/svc-intelligence-sdk",
    "description": "Delegates document content extraction and analysis to svc-intelligence",
    "usedEndpoints": [
      "api-analyse",
      "api-dynamo-scan"
    ]
  },
  {
    "from": "svc-billing-automation",
    "to": "svc-modularisation",
    "sdkPackage": "@skelloapp/svc-modularisation-sdk",
    "description": "Enables/disables product modules after subscription changes",
    "usedEndpoints": [
      "api-get-modularisation"
    ]
  },
  {
    "from": "svc-kpis-v2",
    "to": "svc-pos",
    "sdkPackage": "@skelloapp/svc-pos-sdk",
    "description": "Fetches POS revenue data to compute labour cost ratio KPIs",
    "usedEndpoints": [
      "api-get-chift-providers",
      "api-handle-chift-webhook"
    ]
  },
  {
    "from": "svc-communications-v2",
    "to": "svc-requests",
    "sdkPackage": "@skelloapp/svc-requests-sdk",
    "description": "Reads request details to include in approval/rejection notification emails",
    "usedEndpoints": [
      "api-get-leave-requests"
    ]
  },
  {
    "from": "svc-intelligence",
    "to": "svc-documents-esignature",
    "sdkPackage": "@skelloapp/svc-esignature-sdk",
    "description": "Initiates e-signature requests after AI document preparation",
    "usedEndpoints": [
      "api-attendance-sheet-signature-reminder",
      "api-document-signable"
    ]
  },
  {
    "from": "svc-skello-assistant",
    "to": "svc-documents-esignature",
    "sdkPackage": "@skelloapp/svc-esignature-sdk",
    "description": "Handles user requests to sign documents via the AI assistant",
    "usedEndpoints": [
      "api-attendance-sheet-signature-reminder",
      "api-document-signable"
    ]
  },
  {
    "from": "superadmin",
    "to": "svc-billing-automation",
    "sdkPackage": "@skelloapp/svc-billing-automation-sdk",
    "description": "Manage subscription quotes, contracts and billing lifecycle for organisations",
    "usedEndpoints": [
      "api-get-quote",
      "api-create-quote"
    ]
  },
  {
    "from": "superadmin",
    "to": "svc-communications-v2",
    "sdkPackage": "@skelloapp/svc-communications-v2-sdk",
    "description": "Send high and low priority notifications to users",
    "usedEndpoints": [
      "bulk-create-high-priority-notification-route",
      "bulk-create-low-priority-notification-route"
    ]
  },
  {
    "from": "superadmin",
    "to": "svc-employees",
    "sdkPackage": "@skelloapp/svc-employees-client",
    "description": "Read and configure employee absence settings and HR data",
    "usedEndpoints": [
      "api-get-absence-configs",
      "api-upsert-absence-config"
    ]
  },
  {
    "from": "superadmin",
    "to": "svc-events",
    "sdkPackage": "@skelloapp/svc-events-sdk",
    "description": "Create and query audit events for admin activity tracking",
    "usedEndpoints": [
      "api-event-create",
      "get-events-api"
    ]
  },
  {
    "from": "superadmin",
    "to": "svc-labour-laws",
    "sdkPackage": "@skelloapp/svc-labour-laws-sdk",
    "description": "Configure labour law rules and shop compliance settings",
    "usedEndpoints": [
      "api-upsert-shop",
      "api-batch-upsert-shops"
    ]
  },
  {
    "from": "superadmin",
    "to": "svc-punch",
    "sdkPackage": "@skelloapp/svc-punch-sdk",
    "description": "Access punch clock data for admin oversight and auditing",
    "usedEndpoints": [
      "api-get-clocks-in-out",
      "api-create-clock-in-out"
    ]
  },
  {
    "from": "superadmin",
    "to": "svc-reports",
    "sdkPackage": "@skelloapp/svc-reports-sdk",
    "description": "Generate and access operational and compliance reports",
    "usedEndpoints": [
      "api-get-pam-configs",
      "api-create-pam-config"
    ]
  },
  {
    "from": "superadmin",
    "to": "svc-shops",
    "sdkPackage": "@skelloapp/svc-shops-sdk",
    "description": "Read and update organisation and shop configuration",
    "usedEndpoints": [
      "api-get-organisations-config",
      "api-upsert-organisation-config"
    ]
  },
  {
    "from": "superadmin",
    "to": "svc-trackers",
    "sdkPackage": "@skelloapp/svc-trackers-sdk",
    "description": "Manage tracker settings for shops",
    "usedEndpoints": [
      "api-activate-shop-tracker-settings",
      "api-list-shop-tracker-settings"
    ]
  },
  {
    "from": "skello-app",
    "to": "svc-billing-automation",
    "sdkPackage": "Microservices::BillingAutomationService (HTTParty)",
    "description": "Synchronise shops with billing, upsert and update shop contracts",
    "usedEndpoints": [
      "api-get-quote",
      "api-create-quote"
    ]
  },
  {
    "from": "skello-app",
    "to": "svc-communications-v2",
    "sdkPackage": "Microservices::Communications (SQS)",
    "description": "Send high/low-priority email notifications to users via SQS queues",
    "usedEndpoints": [
      "bulk-create-high-priority-notification-route",
      "bulk-create-low-priority-notification-route"
    ]
  },
  {
    "from": "skello-app",
    "to": "svc-documents-v2",
    "sdkPackage": "Microservices::DocumentsV2Service (HTTParty)",
    "description": "Print and generate PDF/XLSX documents, retrieve and delete employee documents",
    "usedEndpoints": [
      "api-bulk-send-signature-reminders",
      "cancel-signature-request-api"
    ]
  },
  {
    "from": "skello-app",
    "to": "svc-employees",
    "sdkPackage": "Microservices::EmployeeService (HTTParty)",
    "description": "Read and write employee HR data, absence configurations and settings",
    "usedEndpoints": [
      "api-get-absence-configs",
      "api-upsert-absence-config"
    ]
  },
  {
    "from": "skello-app",
    "to": "svc-events",
    "sdkPackage": "Microservices::EventService (HTTParty + SQS)",
    "description": "Create audit events on user actions and send activity logs asynchronously via SQS",
    "usedEndpoints": [
      "api-event-create",
      "get-events-api"
    ]
  },
  {
    "from": "skello-app",
    "to": "svc-labour-laws",
    "sdkPackage": "Microservices::LabourLawService (HTTParty)",
    "description": "Upsert shop labour law config, update rule overrides, fetch enabled labour laws",
    "usedEndpoints": [
      "api-upsert-shop",
      "api-batch-upsert-shops"
    ]
  },
  {
    "from": "skello-app",
    "to": "svc-reports",
    "sdkPackage": "Microservices::ReportService (HTTParty)",
    "description": "Fetch PAM configs and payroll software settings for export generation",
    "usedEndpoints": [
      "api-get-pam-configs",
      "api-create-pam-config"
    ]
  },
  {
    "from": "skello-app",
    "to": "svc-requests",
    "sdkPackage": "Microservices::RequestService (HTTParty)",
    "description": "Manage leave requests on behalf of the mobile client — create, update and delete",
    "usedEndpoints": [
      "api-get-leave-requests",
      "api-create-leave-request",
      "api-update-leave-request"
    ]
  },
  {
    "from": "skello-app",
    "to": "svc-shops",
    "sdkPackage": "Microservices::ShopsService (HTTParty)",
    "description": "Manage shop missions — fetch, purge and retrieve by ID",
    "usedEndpoints": [
      "api-get-organisations-config",
      "api-get-shops"
    ]
  },
  {
    "from": "skello-app",
    "to": "svc-documents-esignature",
    "sdkPackage": "Microservices::EsignatureService (HTTParty)",
    "description": "Trigger e-signature flows and query signature status for employee documents",
    "usedEndpoints": [
      "api-document-signable",
      "api-document-signature-reminder"
    ]
  },
  {
    "from": "skello-app",
    "to": "svc-feature-flags",
    "sdkPackage": "Microservices::FeatureFlagService (HTTParty)",
    "description": "Read and toggle feature flags and dev flags at runtime",
    "usedEndpoints": [
      "api-get-feature-flags",
      "api-update-feature-flag"
    ]
  },
  {
    "from": "skello-app",
    "to": "svc-modularisation",
    "sdkPackage": "Microservices::ModularisationService (HTTParty)",
    "description": "Query module activation status for shops and organisations",
    "usedEndpoints": [
      "api-get-modularisation"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "skello-app",
    "sdkPackage": "axios / @skelloapp/client-http-lib",
    "description": "Core Rails API — auth, scheduling data, users, organisations and all legacy endpoints",
    "usedEndpoints": []
  },
  {
    "from": "skello-app-front",
    "to": "svc-automatic-scheduling",
    "sdkPackage": "@skelloapp/svc-automatic-scheduling-sdk",
    "description": "Trigger AI-based automatic schedule generation for a shop",
    "usedEndpoints": [
      "api-trigger-auto-scheduling",
      "api-get-shift-replacements"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-bff",
    "sdkPackage": "@skelloapp/svc-bff-sdk",
    "description": "BFF orchestration — batch document operations and KPI aggregation",
    "usedEndpoints": [
      "api-orchestrate-documents",
      "api-bulk-update-kpis"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-billing-automation",
    "sdkPackage": "@skelloapp/svc-billing-automation-sdk",
    "description": "Read subscription quotes and billing state for the organisation",
    "usedEndpoints": [
      "api-get-quote",
      "api-create-quote"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-documents-v2",
    "sdkPackage": "@skelloapp/svc-documents-v2-client",
    "description": "Print, generate and manage employee and planning documents",
    "usedEndpoints": [
      "api-bulk-send-signature-reminders",
      "cancel-signature-request-api"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-employees",
    "sdkPackage": "@skelloapp/svc-employees-client",
    "description": "Read and update employee profiles, contracts and absence settings",
    "usedEndpoints": [
      "api-get-absence-configs",
      "api-upsert-absence-config"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-enrollment",
    "sdkPackage": "@skelloapp/svc-enrollment-sdk",
    "description": "Drive employee and shop onboarding workflows",
    "usedEndpoints": [
      "api-get-onboardings",
      "api-create-onboarding"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-events",
    "sdkPackage": "@skelloapp/svc-events-sdk",
    "description": "Stream audit events for the activity feed and change history",
    "usedEndpoints": [
      "api-event-create",
      "get-events-api"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-hris",
    "sdkPackage": "@skelloapp/svc-hris-sdk",
    "description": "Connect and manage HRIS integrations for automatic employee sync",
    "usedEndpoints": [
      "api-get-hris-integrations",
      "api-connect-hris-integration"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-intelligence",
    "sdkPackage": "@skelloapp/svc-intelligence-sdk",
    "description": "Fetch AI-powered workforce insights and activity predictions",
    "usedEndpoints": [
      "api-analyse"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-kpis-v2",
    "sdkPackage": "@skelloapp/svc-kpis-v2-sdk",
    "description": "Load KPI dashboards — revenue, labour cost, activity predictions",
    "usedEndpoints": [
      "api-get-activity-prediction-settings",
      "api-upsert-activity-prediction-settings"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-labour-laws",
    "sdkPackage": "@skelloapp/svc-labour-laws-sdk",
    "description": "Fetch applicable labour laws and compliance rules for the shop",
    "usedEndpoints": [
      "api-upsert-shop",
      "api-batch-upsert-shops"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-pos",
    "sdkPackage": "@skelloapp/svc-pos-sdk",
    "description": "Integrate POS systems for revenue data and shift reconciliation",
    "usedEndpoints": [
      "api-get-chift-providers",
      "api-handle-chift-webhook"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-punch",
    "sdkPackage": "@skelloapp/svc-punch-sdk",
    "description": "Display and validate employee punch clock records",
    "usedEndpoints": [
      "api-get-clocks-in-out",
      "api-create-clock-in-out"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-reports",
    "sdkPackage": "@skelloapp/svc-reports-sdk",
    "description": "Generate payroll exports, PAM configs and compliance reports",
    "usedEndpoints": [
      "api-get-pam-configs",
      "api-create-pam-config"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-requests",
    "sdkPackage": "@skelloapp/svc-requests-sdk",
    "description": "Create, approve and track employee leave and availability requests",
    "usedEndpoints": [
      "api-get-leave-requests",
      "api-create-leave-request",
      "api-update-leave-request"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-shops",
    "sdkPackage": "@skelloapp/svc-shops-sdk",
    "description": "Load shop configuration, missions and organisation settings",
    "usedEndpoints": [
      "api-get-organisations-config",
      "api-get-shops"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-skello-assistant",
    "sdkPackage": "@skelloapp/svc-skello-assistant-sdk",
    "description": "Chat with the AI assistant for scheduling help and recommendations",
    "usedEndpoints": [
      "api-chat",
      "api-conversation-feedback"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-trackers",
    "sdkPackage": "@skelloapp/svc-trackers-sdk",
    "description": "Manage time tracker and geofencing settings for shops",
    "usedEndpoints": [
      "api-activate-shop-tracker-settings",
      "api-list-shop-tracker-settings"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-users",
    "sdkPackage": "@skelloapp/svc-users-sdk",
    "description": "Handle user authentication, SSO and capability checks",
    "usedEndpoints": [
      "api-login-capability",
      "api-sso-callback"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-workload-plan",
    "sdkPackage": "@skelloapp/workload-plan-sdk",
    "description": "Create and manage workload plans for staffing forecasts",
    "usedEndpoints": [
      "api-get-workload-plans-v1",
      "api-create-workload-plan-v1"
    ]
  },
  {
    "from": "svc-employees",
    "to": "svc-hris",
    "sdkPackage": "@skelloapp/svc-hris-sdk",
    "description": "Sync employee records to connected HRIS integrations after create/update",
    "usedEndpoints": [
      "api-get-hris-integrations",
      "api-connect-hris-integration"
    ]
  },
  {
    "from": "svc-employees",
    "to": "svc-events",
    "sdkPackage": "@skelloapp/svc-events-sdk",
    "description": "Emit audit events on employee data changes",
    "usedEndpoints": [
      "api-event-create"
    ]
  },
  {
    "from": "svc-bff-planning",
    "to": "skello-app",
    "sdkPackage": "@skelloapp/skello-app-sdk",
    "description": "Fetches shop, employees, conventions, alerts and unavailabilities for scheduling context via SkelloAppClient; writes shift assignments back (currently in dry-run mode)",
    "usedEndpoints": []
  },
  {
    "from": "svc-automatic-scheduling",
    "to": "skello-app",
    "sdkPackage": "@skelloapp/skello-app-sdk",
    "description": "Fetches planning data (shop, users, competencies) in the SFN dataFetcher step; writes optimised shift assignments back in the SFN assignShifts step via SkelloAppClient",
    "usedEndpoints": []
  },
  {
    "from": "skello-app",
    "to": "svc-shifts",
    "sdkPackage": "@skelloapp/svc-shifts-sdk",
    "description": "Updates shift metrics after creation, update or bulk operations",
    "usedEndpoints": [
      "api-get-shop-and-orga-shift-metrics"
    ]
  },
  {
    "from": "svc-reports",
    "to": "svc-shifts",
    "sdkPackage": "@skelloapp/svc-shifts-sdk",
    "description": "Fetches detailed shift data for report generation",
    "usedEndpoints": [
      "api-get-shift-details"
    ]
  }
])

// Enrich connections with inferred communication details (explicit values win)
const connections: ServiceConnection[] = raw.map(conn => {
  const defaults = inferCommunicationDefaults(conn.sdkPackage)
  return {
    ...conn,
    communicationType: conn.communicationType ?? defaults.communicationType,
    protocol: conn.protocol ?? defaults.protocol,
    authType: conn.authType ?? defaults.authType,
  }
})

export default connections
