import { ServiceConnectionSchema } from '@dependency-explorer/schema'
import type { ServiceConnection } from '@dependency-explorer/schema'
import { z } from 'zod'

/**
 * Service-to-service connections.
 * communicationType / protocol / authType are explicit on every entry —
 * never inferred from sdkPackage naming (ADR-0004).
 */
const connections: ServiceConnection[] = z.array(ServiceConnectionSchema).parse([
  {
    "from": "svc-events",
    "to": "svc-communications-v2",
    "sdkPackage": "@skelloapp/svc-communications-v2-sdk",
    "communicationType": "async",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Publishes event notifications to employees via email/push",
    "usedEndpoints": [
      "bulk-create-low-priority-email-route"
    ]
  },
  {
    "from": "svc-billing-automation",
    "to": "svc-communications-v2",
    "sdkPackage": "@skelloapp/svc-communications-v2-sdk",
    "communicationType": "async",
    "protocol": "rest",
    "authType": "jwt",
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
    "communicationType": "async",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Notifies employees when a document is ready to sign",
    "usedEndpoints": [
      "bulk-create-low-priority-email-route"
    ]
  },
  {
    "from": "svc-hris",
    "to": "svc-communications-v2",
    "sdkPackage": "@skelloapp/svc-communications-v2-sdk",
    "communicationType": "async",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Sends HRIS sync completion and mismatch alerts",
    "usedEndpoints": [
      "bulk-create-low-priority-email-route"
    ]
  },
  {
    "from": "svc-users",
    "to": "svc-communications-v2",
    "sdkPackage": "@skelloapp/svc-communications-v2-sdk",
    "communicationType": "async",
    "protocol": "rest",
    "authType": "jwt",
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
    "communicationType": "async",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Notifies employees of request approval/rejection",
    "usedEndpoints": [
      "bulk-create-high-priority-email-route",
      "bulk-create-high-priority-notification-route"
    ]
  },
  {
    "from": "svc-employees",
    "to": "svc-communications-v2",
    "sdkPackage": "@skelloapp/svc-communications-v2-sdk",
    "communicationType": "async",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Sends onboarding invitation emails to new employees",
    "usedEndpoints": [
      "bulk-create-low-priority-email-route"
    ]
  },
  {
    "from": "svc-intelligence",
    "to": "svc-documents-v2",
    "sdkPackage": "@skelloapp/svc-documents-v2-client",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
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
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Retrieves documents to attach to emails (e.g. payslips, contracts)",
    "usedEndpoints": [
      "api-bulk-send-signature-reminders",
      "api-bulk-send-reminders-from-filters"
    ]
  },
  {
    "from": "svc-documents-esignature",
    "to": "svc-documents-v2",
    "sdkPackage": "@skelloapp/svc-documents-v2-client",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Retrieves document file for e-signature provider and updates status after signing",
    "usedEndpoints": [
      "api-bulk-send-signature-reminders"
    ]
  },
  {
    "from": "svc-bff",
    "to": "svc-documents-v2",
    "sdkPackage": "@skelloapp/svc-documents-v2-client",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
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
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Looks up employee details when building shop/team rosters",
    "usedEndpoints": [
      "api-get-employee"
    ]
  },
  {
    "from": "svc-hris",
    "to": "svc-employees",
    "sdkPackage": "@skelloapp/svc-employees-client",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Syncs HRIS employee data into Skello employee records",
    "usedEndpoints": [
      "api-get-employee"
    ]
  },
  {
    "from": "svc-kpis-v2",
    "to": "svc-employees",
    "sdkPackage": "@skelloapp/svc-employees-client",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Retrieves employee contract data (hours, costs) for KPI computation",
    "usedEndpoints": []
  },
  {
    "from": "svc-trackers",
    "to": "svc-search",
    "sdkPackage": "@skelloapp/svc-search-sdk",
    "communicationType": "sync",
    "protocol": "mongodb",
    "authType": "internal",
    "description": "Reads raw shift and poste replica collections from svc-search's shared MongoDB over VPC for labour-law counter computation (RawShiftRepository, RawPosteRepository; SSM svcSearch/MONGO_DB_*). The SDK is the collection DTO contract — there is no HTTP call. (Corrected 2026-06-10: previous 'indexes tracker entries via REST' was invented.)",
    "usedEndpoints": []
  },
  {
    "from": "svc-shops",
    "to": "svc-search",
    "sdkPackage": "@skelloapp/svc-search-sdk",
    "communicationType": "sync",
    "protocol": "mongodb",
    "authType": "internal",
    "description": "Reads raw shop and shift replica collections from svc-search's shared MongoDB over VPC (RawShopRepository, ShiftRepository — MissionWage/MissionHours processors; SSM svcSearch/MONGO_DB_*). The SDK is the collection DTO contract — there is no HTTP call. (Corrected 2026-06-10: previous 'indexes shop locations via REST' was invented.)",
    "usedEndpoints": []
  },
  {
    "from": "svc-kpis-v2",
    "to": "svc-search",
    "sdkPackage": "@skelloapp/svc-search-sdk",
    "communicationType": "sync",
    "protocol": "mongodb",
    "authType": "internal",
    "description": "Reads raw shop replica collections from svc-search's shared MongoDB over VPC for KPI computation (RawShopRepository; env SVC_SEARCH_MONGO_DB_URI from SSM svcSearch/MONGO_DB_URI). The SDK is the collection DTO contract — there is no HTTP call. (Corrected 2026-06-10: previous 'indexes KPI snapshots via REST' was invented; confirms the 2026 SvcKpis board.)",
    "usedEndpoints": []
  },
  {
    "from": "svc-automatic-scheduling",
    "to": "svc-search",
    "sdkPackage": "@skelloapp/svc-search-sdk",
    "communicationType": "sync",
    "protocol": "mongodb",
    "authType": "internal",
    "description": "Reads shifts and postes directly from svc-search's MongoDB over VPC for eligibility computation and replacement candidate ranking (no HTTP — ShiftRepository + PosteRepository direct DB access; SSM svcSearch/MONGO_DB_NAME)",
    "usedEndpoints": []
  },
  {
    "from": "svc-bff-planning",
    "to": "svc-search",
    "sdkPackage": "@skelloapp/svc-search-sdk",
    "communicationType": "sync",
    "protocol": "mongodb",
    "authType": "internal",
    "description": "Reads shifts and postes directly from svc-search's MongoDB over VPC (no HTTP — ShiftRepository + PosteRepository direct DB access)",
    "usedEndpoints": []
  },
  {
    "from": "svc-users",
    "to": "svc-punch",
    "sdkPackage": "@skelloapp/svc-punch-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Provisions punch clock tokens for employees at login",
    "usedEndpoints": [
      "api-create-clock-in-out"
    ]
  },
  {
    "from": "svc-communications-v2",
    "to": "svc-events",
    "sdkPackage": "@skelloapp/svc-events-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Publishes communication_sent and communication_failed events",
    "usedEndpoints": [
      "api-event-create"
    ]
  },
  {
    "from": "svc-employees",
    "to": "svc-events",
    "sdkPackage": "@skelloapp/svc-events-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Publishes employee.created, employee.updated, employee.deleted domain events",
    "usedEndpoints": [
      "api-event-create"
    ]
  },
  {
    "from": "svc-requests",
    "to": "svc-events",
    "sdkPackage": "@skelloapp/svc-events-sdk",
    "communicationType": "async",
    "protocol": "sqs",
    "authType": "iam-role",
    "description": "Sends activity-log batches to svc-events via SQS (ActivityLogCreateSqs — events-sdk DTOs as the message contract)",
    "usedEndpoints": []
  },
  {
    "from": "svc-hris",
    "to": "svc-shops",
    "sdkPackage": "@skelloapp/svc-shops-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Maps HRIS cost centres to Skello shop locations during sync",
    "usedEndpoints": []
  },
  {
    "from": "svc-workload-plan",
    "to": "svc-kpis-v2",
    "sdkPackage": "@skelloapp/svc-kpis-v2-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Fetches historical KPIs to train workload forecasting models",
    "usedEndpoints": []
  },
  {
    "from": "svc-bff",
    "to": "svc-kpis-v2",
    "sdkPackage": "@skelloapp/svc-kpis-v2-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Includes KPI summary in the composite BFF dashboard response",
    "usedEndpoints": [
      "update-manual-kpis-bulk"
    ]
  },
  {
    "from": "svc-documents-v2",
    "to": "svc-intelligence",
    "sdkPackage": "@skelloapp/svc-intelligence-sdk",
    "communicationType": "async",
    "protocol": "sqs",
    "authType": "iam-role",
    "description": "Sends documents for AI data extraction via SQS (DocumentExtractDataSqsRepository — intelligence-sdk DTOs as the message contract); extraction results consumed back through analyze listener jobs",
    "usedEndpoints": []
  },
  {
    "from": "svc-billing-automation",
    "to": "svc-modularisation",
    "sdkPackage": "@skelloapp/svc-modularisation-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Enables/disables product modules after subscription changes",
    "usedEndpoints": [
      "api-get-modularisation"
    ]
  },
  {
    "from": "svc-kpis-v2",
    "to": "svc-pos",
    "sdkPackage": "@skelloapp/svc-pos-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Fetches POS revenue data to compute labour cost ratio KPIs",
    "usedEndpoints": [
      "api-get-chift-providers"
    ]
  },
  {
    "from": "svc-communications-v2",
    "to": "svc-requests",
    "sdkPackage": "@skelloapp/svc-requests-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Reads request details to include in approval/rejection notification emails",
    "usedEndpoints": [
      "api-get-leave-requests"
    ]
  },
  {
    "from": "svc-intelligence",
    "to": "svc-documents-esignature",
    "sdkPackage": "@skelloapp/svc-esignature-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Polls e-signature document status (SDK getDocumentsStatus) during document AI workflows",
    "usedEndpoints": [
      "api-documents-status"
    ]
  },
  {
    "from": "superadmin",
    "to": "svc-billing-automation",
    "sdkPackage": "@skelloapp/svc-billing-automation-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Manage subscription quotes, contracts and billing lifecycle for organisations",
    "usedEndpoints": [
      "api-get-shops-quota"
    ]
  },
  {
    "from": "superadmin",
    "to": "svc-communications-v2",
    "sdkPackage": "@skelloapp/svc-communications-v2-sdk",
    "communicationType": "async",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Send high and low priority notifications to users",
    "usedEndpoints": [
      "api-send-test-email"
    ]
  },
  {
    "from": "superadmin",
    "to": "svc-employees",
    "sdkPackage": "@skelloapp/svc-employees-client",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Read and configure employee absence settings and HR data",
    "usedEndpoints": [
      "api-upsert-absence-config"
    ]
  },
  {
    "from": "superadmin",
    "to": "svc-events",
    "sdkPackage": "@skelloapp/svc-events-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
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
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Configure labour law rules and shop compliance settings",
    "usedEndpoints": [
      "api-upsert-shop"
    ]
  },
  {
    "from": "superadmin",
    "to": "svc-punch",
    "sdkPackage": "@skelloapp/svc-punch-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Access punch clock data for admin oversight and auditing",
    "usedEndpoints": [
      "api-clocks-in-out-by-user-id",
      "api-setting-read-by-shop-id-2",
      "api-setting-partial-update-2"
    ]
  },
  {
    "from": "superadmin",
    "to": "svc-reports",
    "sdkPackage": "@skelloapp/svc-reports-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Administer payroll-export configuration — PAM configs and automated report scheduling (PAMRework, AutomatedReportModal)",
    "usedEndpoints": [
      "api-delete-schedule-in-pam-config"
    ]
  },
  {
    "from": "superadmin",
    "to": "svc-shops",
    "sdkPackage": "@skelloapp/svc-shops-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Read and update organisation and shop configuration",
    "usedEndpoints": [
      "api-get-organisations-config"
    ]
  },
  {
    "from": "superadmin",
    "to": "svc-trackers",
    "sdkPackage": "@skelloapp/svc-trackers-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Manage tracker settings for shops",
    "usedEndpoints": []
  },
  {
    "from": "skello-app",
    "to": "svc-billing-automation",
    "sdkPackage": "Microservices::BillingAutomationService (HTTParty)",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "internal",
    "description": "Synchronise shops with billing, upsert and update shop contracts",
    "usedEndpoints": []
  },
  {
    "from": "skello-app",
    "to": "svc-communications-v2",
    "sdkPackage": "Microservices::Communications (SQS)",
    "communicationType": "async",
    "protocol": "rest",
    "authType": "iam-role",
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
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "internal",
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
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "internal",
    "description": "Read and write employee HR data, absence configurations and settings",
    "usedEndpoints": [
      "api-upsert-absence-config"
    ]
  },
  {
    "from": "skello-app",
    "to": "svc-events",
    "sdkPackage": "Microservices::EventService (HTTParty + SQS)",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
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
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "internal",
    "description": "Upsert shop labour law config, update rule overrides, fetch enabled labour laws",
    "usedEndpoints": [
      "api-upsert-shop"
    ]
  },
  {
    "from": "skello-app",
    "to": "svc-reports",
    "sdkPackage": "Microservices::ReportService (HTTParty)",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "internal",
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
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "internal",
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
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "internal",
    "description": "Manage shop missions — fetch, purge and retrieve by ID",
    "usedEndpoints": [
      "api-get-organisations-config"
    ]
  },
  {
    "from": "skello-app",
    "to": "svc-documents-esignature",
    "sdkPackage": "Microservices::EsignatureService (HTTParty)",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "internal",
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
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "internal",
    "description": "Read and toggle feature flags and dev flags at runtime",
    "usedEndpoints": []
  },
  {
    "from": "skello-app",
    "to": "svc-modularisation",
    "sdkPackage": "Microservices::ModularisationService (HTTParty)",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "internal",
    "description": "Query module activation status for shops and organisations",
    "usedEndpoints": [
      "api-get-modularisation"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "skello-app",
    "sdkPackage": "axios / @skelloapp/client-http-lib",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Core Rails API — auth, scheduling data, users, organisations and all legacy endpoints",
    "usedEndpoints": []
  },
  {
    "from": "skello-app-front",
    "to": "svc-automatic-scheduling",
    "sdkPackage": "@skelloapp/svc-automatic-scheduling-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Trigger AI-based automatic schedule generation for a shop",
    "usedEndpoints": [
      "api-trigger-automatic-assignment",
      "api-get-shift-replacements"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-bff",
    "sdkPackage": "@skelloapp/svc-bff-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
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
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Read subscription quotes and billing state for the organisation",
    "usedEndpoints": []
  },
  {
    "from": "skello-app-front",
    "to": "svc-documents-v2",
    "sdkPackage": "@skelloapp/svc-documents-v2-client",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
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
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Read and update employee profiles, contracts and absence settings",
    "usedEndpoints": [
      "api-upsert-absence-config"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-enrollment",
    "sdkPackage": "@skelloapp/svc-enrollment-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Drive employee and shop onboarding workflows",
    "usedEndpoints": [
      "api-create-onboarding"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-events",
    "sdkPackage": "@skelloapp/svc-events-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
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
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Connect and manage HRIS integrations for automatic employee sync",
    "usedEndpoints": [
      "api-connect-hris-integration"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-intelligence",
    "sdkPackage": "@skelloapp/svc-intelligence-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Fetch AI-powered workforce insights and activity predictions",
    "usedEndpoints": []
  },
  {
    "from": "skello-app-front",
    "to": "svc-kpis-v2",
    "sdkPackage": "@skelloapp/svc-kpis-v2-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Load KPI dashboards — revenue, labour cost, activity predictions",
    "usedEndpoints": []
  },
  {
    "from": "skello-app-front",
    "to": "svc-labour-laws",
    "sdkPackage": "@skelloapp/svc-labour-laws-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Fetch applicable labour laws and compliance rules for the shop",
    "usedEndpoints": [
      "api-upsert-shop"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-pos",
    "sdkPackage": "@skelloapp/svc-pos-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Integrate POS systems for revenue data and shift reconciliation",
    "usedEndpoints": [
      "api-get-chift-providers"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-punch",
    "sdkPackage": "@skelloapp/svc-punch-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Display and validate employee punch clock records",
    "usedEndpoints": [
      "api-create-clock-in-out"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-reports",
    "sdkPackage": "@skelloapp/svc-reports-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
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
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
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
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Load shop configuration, missions and organisation settings",
    "usedEndpoints": [
      "api-get-organisations-config"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-skello-assistant",
    "sdkPackage": "@skelloapp/svc-skello-assistant-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
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
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Manage time tracker and geofencing settings for shops",
    "usedEndpoints": []
  },
  {
    "from": "skello-app-front",
    "to": "svc-users",
    "sdkPackage": "@skelloapp/svc-users-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Handle user authentication, SSO and capability checks",
    "usedEndpoints": [
      "api-sso-callback"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-workload-plan",
    "sdkPackage": "@skelloapp/workload-plan-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Create and manage workload plans for staffing forecasts",
    "usedEndpoints": [
      "api-get-workload-plans-v1",
      "api-create-workload-plan-v1"
    ]
  },
  {
    "from": "svc-bff-planning",
    "to": "skello-app",
    "sdkPackage": "@skelloapp/skello-app-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Fetches shop, employees, conventions, alerts and unavailabilities for scheduling context via SkelloAppClient; writes shift assignments back (currently in dry-run mode)",
    "usedEndpoints": []
  },
  {
    "from": "svc-automatic-scheduling",
    "to": "skello-app",
    "sdkPackage": "@skelloapp/skello-app-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Fetches planning data (shop, users, competencies) in the SFN dataFetcher step; writes optimised shift assignments back in the SFN assignShifts step via SkelloAppClient",
    "usedEndpoints": []
  },
  {
    "from": "svc-automatic-scheduling",
    "to": "svc-workload-plan",
    "sdkPackage": "@skelloapp/workload-plan-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Fetches workload plans during scheduling context preparation (dataFetcher step)",
    "usedEndpoints": [
      "api-get-workload-plans-v2"
    ]
  },
  {
    "from": "svc-bff",
    "to": "skello-app",
    "sdkPackage": "@skelloapp/skello-app-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "BFF aggregates core monolith data (SDK client; endpoints used not yet mapped)",
    "usedEndpoints": []
  },
  {
    "from": "svc-bff",
    "to": "svc-employees",
    "sdkPackage": "@skelloapp/svc-employees-client",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "BFF reads employee data (SDK client; endpoints used not yet mapped)",
    "usedEndpoints": []
  },
  {
    "from": "svc-bff",
    "to": "svc-shifts",
    "sdkPackage": "@skelloapp/svc-shifts-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "BFF reads shift data (SDK client; endpoints used not yet mapped)",
    "usedEndpoints": [
      "api-get-shift-details"
    ]
  },
  {
    "from": "svc-bff",
    "to": "svc-shops",
    "sdkPackage": "@skelloapp/svc-shops-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "BFF reads shop data (SDK client; endpoints used not yet mapped)",
    "usedEndpoints": []
  },
  {
    "from": "svc-billing-automation",
    "to": "svc-users",
    "sdkPackage": "@skelloapp/svc-users-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Reads user accounts for billing operations (SDK client; endpoints used not yet mapped)",
    "usedEndpoints": [
      "api-check-user-exists"
    ]
  },
  {
    "from": "svc-employees",
    "to": "svc-search",
    "sdkPackage": "@skelloapp/svc-search-sdk",
    "communicationType": "sync",
    "protocol": "mongodb",
    "authType": "internal",
    "description": "Reads raw contract replica collections from svc-search's shared MongoDB over VPC (ActiveContractManager; SSM svcSearch/MONGO_DB_*). The SDK is the collection DTO contract — there is no HTTP call. (Corrected 2026-06-10.)",
    "usedEndpoints": []
  },
  {
    "from": "svc-employees",
    "to": "svc-users",
    "sdkPackage": "@skelloapp/svc-users-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Consumes svc-users API (SDK client; endpoints used not yet mapped)",
    "usedEndpoints": [
      "api-invite-user"
    ]
  },
  {
    "from": "svc-enrollment",
    "to": "svc-employees",
    "sdkPackage": "@skelloapp/svc-employees-client",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Enrollment provisions employee records (SDK client; endpoints used not yet mapped)",
    "usedEndpoints": []
  },
  {
    "from": "svc-enrollment",
    "to": "svc-labour-laws",
    "sdkPackage": "@skelloapp/svc-labour-laws-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Enrollment configures labour-law settings (SDK client; endpoints used not yet mapped)",
    "usedEndpoints": []
  },
  {
    "from": "svc-hris",
    "to": "skello-app",
    "sdkPackage": "@skelloapp/skello-app-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "HRIS sync reads/writes monolith data (SDK client; endpoints used not yet mapped)",
    "usedEndpoints": []
  },
  {
    "from": "svc-search",
    "to": "skello-app",
    "sdkPackage": "@skelloapp/skello-app-sdk",
    "communicationType": "async",
    "protocol": "cdc",
    "authType": "internal",
    "description": "Replicates monolith tables (shops, shifts, contracts, employees…) into its raw Mongo collections via DMS CDC from the monolith RDS — there is no API call. The skello-app-sdk import is a shared constant only (BodySizeMapping in BaseEmployeeExtraInfoEntity). (Corrected 2026-06-10: previous 'reads monolith data via SDK REST' was wrong.)",
    "usedEndpoints": []
  },
  {
    "from": "svc-trackers",
    "to": "skello-app",
    "sdkPackage": "@skelloapp/skello-app-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Trackers read monolith data (SDK client; endpoints used not yet mapped)",
    "usedEndpoints": []
  },
  {
    "from": "svc-workload-plan",
    "to": "skello-app",
    "sdkPackage": "@skelloapp/skello-app-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Workload plan reads monolith planning data (SDK client; endpoints used not yet mapped)",
    "usedEndpoints": []
  },
  {
    "from": "skello-app",
    "to": "svc-punch",
    "sdkPackage": "Microservices::Punch::* (HTTParty)",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "internal",
    "description": "Monolith punch/badging operations — clock in-out CRUD, punch settings, histories and badging checks",
    "usedEndpoints": [
      "api-create-clock-in-out",
      "api-clocks-in-out-read-by-id",
      "api-clocks-in-out-by-shop-id",
      "api-clocks-in-out-by-user-id",
      "api-get-punch-settings",
      "api-upsert-punch-settings"
    ]
  },
  {
    "from": "skello-app",
    "to": "svc-trackers",
    "sdkPackage": "Microservices::TrackersService (HTTParty)",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "internal",
    "description": "Tracker lifecycle from the monolith — shop tracker settings, employee tracker activation/deactivation, bulk tracker fetch",
    "usedEndpoints": [
      "api-list-shop-settings",
      "api-deactivate-tracker",
      "api-initialize-employee-tracker",
      "api-get-bulk-employee-trackers"
    ]
  },
  {
    "from": "skello-app",
    "to": "svc-users",
    "sdkPackage": "Microservices::UserService (HTTParty)",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "internal",
    "description": "User invitation and confirmation propagation from the monolith",
    "usedEndpoints": [
      "api-invite-user",
      "api-confirm-user"
    ]
  },
  {
    "from": "svc-automatic-scheduling",
    "to": "svc-websockets-v2",
    "sdkPackage": "@skelloapp/svc-websockets-v2-sdk",
    "communicationType": "async",
    "protocol": "sqs",
    "authType": "iam-role",
    "description": "Pushes live progress notifications for auto-scheduling jobs — every SFN pipeline step enqueues SDK TopicMessageModel payloads to the websocket-topicMessage queue (WebsocketSqsRepository), fanned out to the frontend over WebSocket",
    "usedEndpoints": []
  },
  {
    "from": "svc-payroll",
    "to": "svc-hris",
    "sdkPackage": "@skelloapp/svc-hris-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Reads HRIS integration data for payroll provider/company mapping (SDK client; endpoints used not yet mapped)",
    "usedEndpoints": []
  },
  {
    "from": "svc-payroll",
    "to": "svc-communications-v2",
    "sdkPackage": "@skelloapp/svc-communications-v2-sdk",
    "communicationType": "async",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Sends payroll sync notifications through the comms HTTP-fronted SQS ingestion",
    "usedEndpoints": []
  },
  {
    "from": "skello-app-front",
    "to": "svc-documents-esignature",
    "sdkPackage": "svcEsignatureApiUrl (axios)",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Employee documents e-signature follow-up — status polling from the employees store modules and FollowUpDocsEsignatureSidePanel",
    "usedEndpoints": [
      "api-documents-status"
    ]
  },
  {
    "from": "svc-skello-assistant",
    "to": "svc-billing-automation",
    "sdkPackage": "@skelloapp/svc-billing-automation-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "api-key",
    "description": "Freemium AI-agent credits: checks and decrements the organisation's credit balance before/after each chat (BillingAutomationClient — getCreditBalanceWithApiKey/useCredit, featureKey 'ai_agent'; env SVC_BILLING_AUTOMATION_API_URL). (Restored 2026-06-10: previously retired for lack of evidence — the dep lives in the nested serverless/package.json the scanner did not read; the 2026 Freemium board contested the retirement and was right.)",
    "usedEndpoints": [
      "api-get-credit-balance",
      "api-use-credit-balance"
    ]
  },
  {
    "from": "svc-skello-assistant",
    "to": "svc-documents-v2",
    "sdkPackage": "@skelloapp/svc-documents-v2-client",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Assistant document tools read employee documents through the docs-v2 client (tools/Repository/Http/DocumentRepository — ContractAgentManager consumes document content and mime types)",
    "usedEndpoints": []
  },
  {
    "from": "svc-skello-assistant",
    "to": "svc-documents-esignature",
    "sdkPackage": "@skelloapp/svc-esignature-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Assistant contract tools poll e-signature status (tools/Repository/Http/DocumentEsignaturesRepository, DocumentsStatusDto). A LIVE caller on the decommission-watch service — any retirement plan must account for it.",
    "usedEndpoints": []
  },
  {
    "from": "svc-skello-assistant",
    "to": "svc-search",
    "sdkPackage": "@skelloapp/svc-search-sdk",
    "communicationType": "sync",
    "protocol": "mongodb",
    "authType": "internal",
    "description": "Agent employee tools read the employees replica collection from svc-search's shared MongoDB over VPC (tools/Repository/Mongo/Agents/EmployeeRepository; dedicated connection via MONGO_DB_SVC_SEARCH_URI). The SDK is the collection DTO contract — there is no HTTP call.",
    "usedEndpoints": []
  },
  {
    "from": "svc-skello-assistant",
    "to": "svc-shifts",
    "sdkPackage": "@skelloapp/svc-shifts-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "api-key",
    "description": "MCP shift/absence/worked-hours tools call svc-shifts (mcp-server/clients/SvcShiftsClient — SVC_SHIFTS_URI + SVC_SHIFTS_API_KEY; GetEmployeesForShifts, ShiftDetails)",
    "usedEndpoints": []
  },
  {
    "from": "svc-skello-assistant",
    "to": "svc-intelligence",
    "sdkPackage": "MongooseInstance (MONGO_DB_URI → svc-intelligence Mongo)",
    "communicationType": "sync",
    "protocol": "mongodb",
    "authType": "internal",
    "description": "Stores chat conversations and LangGraph checkpoints in svc-intelligence's MongoDB ('FOR continuity we keep using svc int mongo db' — MongooseInstance.ts; collections: conversations, checkpoints, checkpoint_writes with TTL indexes). Shared-store coupling, not an API call.",
    "usedEndpoints": []
  },
  {
    "from": "skello-app-front",
    "to": "svc-websockets-v2",
    "sdkPackage": "@skelloapp/svc-websockets-v2-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Front subscribes to real-time topics through the websockets-v2 SDK (value import in the front workspaces); the push channel itself is the v2 WebSocket API",
    "usedEndpoints": []
  },
  {
    "from": "svc-workload-plan",
    "to": "svc-search",
    "sdkPackage": "@skelloapp/svc-search-sdk",
    "communicationType": "sync",
    "protocol": "mongodb",
    "authType": "internal",
    "description": "Reads raw shop replica collections from svc-search's shared MongoDB over VPC (Repository/MongoDB/RawShopRepository; SSM svcSearch/MONGO_DB_NAME). The SDK is the collection DTO contract — there is no HTTP call.",
    "usedEndpoints": []
  },
  {
    "from": "skello-app",
    "to": "svc-punch",
    "sdkPackage": "ShopMergeService → SNS_MERGE_SHOP_ARN (SNS)",
    "communicationType": "async",
    "protocol": "sns",
    "authType": "internal",
    "description": "Shop-merge fan-out: ShopMergeService (triggered by Shops::MergeShopsJob, Sidekiq) publishes to the MergeShop SNS topic; svc-punch's mergeShop SQS queue is subscribed (serverless.ts pulls skelloApp/SNS_MERGE_SHOP_ARN from SSM)",
    "usedEndpoints": []
  },
  {
    "from": "skello-app",
    "to": "svc-kpis-v2",
    "sdkPackage": "ShopMergeService → SNS_MERGE_SHOP_ARN (SNS)",
    "communicationType": "async",
    "protocol": "sns",
    "authType": "internal",
    "description": "Shop-merge fan-out: ShopMergeService publishes to the MergeShop SNS topic; svc-kpis-v2's SqsMergeShop queue is subscribed (SnsMergeShopSubscription in serverless resources)",
    "usedEndpoints": []
  },
  {
    "from": "skello-app",
    "to": "svc-workload-plan",
    "sdkPackage": "ShopMergeService → SNS_MERGE_SHOP_ARN (SNS)",
    "communicationType": "async",
    "protocol": "sns",
    "authType": "internal",
    "description": "Shop-merge fan-out: ShopMergeService publishes to the MergeShop SNS topic; svc-workload-plan's MergeShopSqs queue is subscribed",
    "usedEndpoints": []
  },
  {
    "from": "skello-app",
    "to": "svc-requests",
    "sdkPackage": "ShopMergeService → SNS_MERGE_SHOP_ARN (SNS)",
    "communicationType": "async",
    "protocol": "sns",
    "authType": "internal",
    "description": "Shop-merge fan-out: ShopMergeService publishes to the MergeShop SNS topic; svc-requests' sqsMergeShop queue is subscribed. (The 2026 boards drew svc-documents-v2 as a fifth consumer — no MergeShop queue or handler exists in its code.)",
    "usedEndpoints": []
  },
  {
    "from": "svc-users",
    "to": "skello-app",
    "sdkPackage": "AuthorizerSkelloAppRepository (SKELLO_APP_API_URL)",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "api-key",
    "description": "Strangler write-back/read-back: the Lambda authorizer validates against the monolith API (SSM skelloApp/SKELLO_APP_API_URL + SKELLO_APP_USERS_API_KEY). svc-users ALSO reads the monolith RDS read-only replica directly (SSM /skl/{env}/skelloapp/rds/db_url_svc_users-ro — SkelloAppUserEntity, licenses, prospects): the 'postgresql svc_users' store drawn on the 2026-04 board is the monolith's replica, not an owned database.",
    "usedEndpoints": []
  },
  {
    "from": "svc-requests",
    "to": "skello-app",
    "sdkPackage": "SkelloAppManager (SKELLO_APP_API_URL)",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "api-key",
    "description": "Strangler write-back: approved leave requests create absence shifts in the monolith (CreateShiftsJobHandler → SkelloAppManager; SSM skelloApp/SKELLO_APP_API_URL + SKELLO_APP_REQUESTS_API_KEY — the POST /private/shifts edge the 2026-03 SvcRequests board drew)",
    "usedEndpoints": []
  },
  {
    "from": "svc-intelligence",
    "to": "svc-websockets",
    "sdkPackage": "WebsocketSqsRepository → websocket-genericMessage-{stage} (SQS)",
    "communicationType": "async",
    "protocol": "sqs",
    "authType": "iam-role",
    "description": "Pushes document-extraction progress to clients through the LEGACY websockets service's genericMessage queue (WEBSOCKET_GENERIC_SQS_URL) — not yet migrated to websockets-v2 (whose only ingestion queue is websocket-topicMessage)",
    "usedEndpoints": []
  },
  {
    "from": "svc-billing-automation",
    "to": "svc-websockets",
    "sdkPackage": "SfnPushWebsocketJobHandler → websocket-pingTypeAndUuid-{stage} (SQS)",
    "communicationType": "async",
    "protocol": "sqs",
    "authType": "iam-role",
    "description": "Step-function billing flows ping clients through the LEGACY websockets service's pingTypeAndUuid queue (WEBSOCKET_SQS_URL in stepFunctions env) — not yet migrated to websockets-v2",
    "usedEndpoints": []
  },
  {
    "from": "skello-app-front",
    "to": "svc-hiring",
    "sdkPackage": "@skelloapp/svc-hiring-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Navbar Hiring entry: generates a Join auto-login token and opens the returned redirectUrl in a new tab (useGenerateJoinTokenApi — provisions the Join account on first use)",
    "usedEndpoints": [
      "api-generate-join-token"
    ]
  },
  {
    "from": "skello-app",
    "to": "svc-hiring",
    "sdkPackage": "Microservices::HiringService (HTTParty)",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "internal",
    "description": "Organisation setup on the Join hiring product (POST /setup via SVC_HIRING_URL)",
    "usedEndpoints": [
      "api-setup"
    ]
  },
  {
    "from": "skello-app-front",
    "to": "svc-payroll",
    "sdkPackage": "@skelloapp/svc-payroll-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "Pay Partners settings page reads variable pay elements and export templates (svc_payroll_client.js — getEvps/getTemplate, env VUE_APP_SVC_PAYROLL_API_URL)",
    "usedEndpoints": [
      "api-evps-list"
    ]
  },
  {
    "from": "svc-billing-automation",
    "to": "skello-app",
    "sdkPackage": "SkelloManager (SKELLO_HOST + SKELLO_BILLING_API_PATH)",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "api-key",
    "description": "Strangler write-back: billing pushes organisation/shop/license state into the monolith (v3/api/billing_automation/* controllers, from_svc_billing_auto guard) — churn processing handlers (Update/DeleteSkelloOrganisation/Shop) and subscription lifecycle changes. Verified 2026-06-15 (SKELLO_API_KEY + SKELLO_HOST in EnvVarsHelper).",
    "usedEndpoints": []
  },
  {
    "from": "svc-employees",
    "to": "skello-app",
    "sdkPackage": "DPAE SFN write-back (SKELLO_APP_API_URL)",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "api-key",
    "description": "Strangler write-back: the DPAE step function updates deposit status in the monolith (UpdateSkelloDpaeStatusSfnJobHandler → DpaeManager; SSM skelloApp/SKELLO_APP_API_URL + SKELLO_APP_EMPLOYEES_API_KEY — the dpae_deposits#update endpoint the monolith marks 'called only by svc-employee'). Verified 2026-06-15.",
    "usedEndpoints": []
  },
  {
    "from": "skello-app-front",
    "to": "svc-kpis",
    "sdkPackage": "@skelloapp/svc-kpis-sdk",
    "communicationType": "sync",
    "protocol": "rest",
    "authType": "jwt",
    "description": "LEGACY v1 usage still live: planning KPIs store reads/writes user KPI display settings (svc_kpis_client getUserKpiSettings/patchUserKpiSettings) alongside the v2 metrics client; base-app SvcKpis client (KpisForDateModel, svcKpisApiUrl). Migration required before v1 decommission.",
    "usedEndpoints": []
  },
  {
    "from": "svc-automatic-scheduling",
    "to": "skello-app",
    "sdkPackage": "serverless stream event → skelloapp-bus (Kinesis, DMS CDC)",
    "communicationType": "async",
    "protocol": "cdc",
    "authType": "internal",
    "description": "Consumes the monolith's DMS CDC backbone (skelloapp-bus Kinesis stream) to keep its local replica of planning data current. Adopted from the AWS-bindings discovery pass, 2026-07-11.",
    "usedEndpoints": []
  },
  {
    "from": "svc-documents-v2",
    "to": "skello-app",
    "sdkPackage": "serverless stream events → skelloapp-bus + svcDocumentsV2-fullload (Kinesis, DMS CDC)",
    "communicationType": "async",
    "protocol": "cdc",
    "authType": "internal",
    "description": "Consumes the monolith's DMS CDC backbone (skelloapp-bus) plus a dedicated svcDocumentsV2-fullload Kinesis stream for initial table loads. Adopted from the AWS-bindings discovery pass, 2026-07-11.",
    "usedEndpoints": []
  },
  {
    "from": "svc-documents-v2",
    "to": "svc-documents-esignature",
    "sdkPackage": "serverless stream event → svcDocumentsEsignature DYNAMO_DB_STREAM_ARN_V2 (DynamoDB stream)",
    "communicationType": "async",
    "protocol": "cdc",
    "authType": "internal",
    "description": "syncEsignatureToSignatureCdcJob consumes svc-documents-esignature's DynamoDB table stream (SSM svcDocumentsEsignature/DYNAMO_DB_STREAM_ARN_V2) to mirror e-signature state onto Signature records — no API call between the two documents services. Adopted from the AWS-bindings discovery pass, 2026-07-11.",
    "usedEndpoints": []
  },
  {
    "from": "svc-employees",
    "to": "skello-app",
    "sdkPackage": "serverless stream event → skelloapp-bus (Kinesis, DMS CDC)",
    "communicationType": "async",
    "protocol": "cdc",
    "authType": "internal",
    "description": "Consumes the monolith's DMS CDC backbone (skelloapp-bus Kinesis stream) to keep employee data replicas current — the inbound replication side of the strangler pattern whose DPAE write-back (REST) shares this pair. Adopted from the AWS-bindings discovery pass, 2026-07-11.",
    "usedEndpoints": []
  },
  {
    "from": "svc-kpis",
    "to": "skello-app",
    "sdkPackage": "serverless stream event → skelloapp-bus (Kinesis, DMS CDC)",
    "communicationType": "async",
    "protocol": "cdc",
    "authType": "internal",
    "description": "LEGACY v1 KPI service consumes the monolith's DMS CDC backbone (skelloapp-bus; KinesisReplayService replays records into its Postgres). Adopted from the AWS-bindings discovery pass, 2026-07-11.",
    "usedEndpoints": []
  },
  {
    "from": "svc-kpis-v2",
    "to": "skello-app",
    "sdkPackage": "serverless stream events → skelloapp-bus + SKELLO_APP_KINESIS_FULL_LOAD_AND_CDC_ARN (Kinesis, DMS CDC)",
    "communicationType": "async",
    "protocol": "cdc",
    "authType": "internal",
    "description": "Consumes the monolith's DMS CDC backbone (skelloapp-bus, deploy-state verified) plus the SSM-configured full-load+CDC stream to feed KPI computation from replicated monolith tables. Adopted from the AWS-bindings discovery pass, 2026-07-11.",
    "usedEndpoints": []
  },
  {
    "from": "svc-pos",
    "to": "skello-app",
    "sdkPackage": "serverless stream event → skelloapp-bus (Kinesis, DMS CDC)",
    "communicationType": "async",
    "protocol": "cdc",
    "authType": "internal",
    "description": "Consumes the monolith's DMS CDC backbone (skelloapp-bus Kinesis stream) to relate POS transactions/forecasts to replicated shop data. Adopted from the AWS-bindings discovery pass, 2026-07-11.",
    "usedEndpoints": []
  },
  {
    "from": "svc-punch",
    "to": "skello-app",
    "sdkPackage": "serverless stream events → skelloapp-bus + skelloapp-svcpunch-fullload (Kinesis, DMS CDC)",
    "communicationType": "async",
    "protocol": "cdc",
    "authType": "internal",
    "description": "Consumes the monolith's DMS CDC backbone (skelloapp-bus) plus a dedicated svcpunch full-load Kinesis stream (deploy-state verified) — the replication that lets the badging system of record work against current shop/employee data. Adopted from the AWS-bindings discovery pass, 2026-07-11.",
    "usedEndpoints": []
  },
  {
    "from": "svc-reports",
    "to": "skello-app",
    "sdkPackage": "serverless stream event → skelloapp-svcreports-fullload (Kinesis, DMS)",
    "communicationType": "async",
    "protocol": "cdc",
    "authType": "internal",
    "description": "Consumes a dedicated skelloapp-svcreports-fullload Kinesis stream (DMS replication of monolith tables); also listens on the monolith's temporary-assets S3 bucket for automated PAM report dispatch (SendAutomatedPAMReportToSFTPJob). Adopted from the AWS-bindings discovery pass, 2026-07-11.",
    "usedEndpoints": []
  },
  {
    "from": "svc-requests",
    "to": "skello-app",
    "sdkPackage": "serverless stream events → skelloapp-bus + svcRequests-fullload (Kinesis, DMS CDC)",
    "communicationType": "async",
    "protocol": "cdc",
    "authType": "internal",
    "description": "Consumes the monolith's DMS CDC backbone (skelloapp-bus) plus a dedicated svcRequests-fullload Kinesis stream — the inbound replication side of the strangler pattern whose absence-shift write-back (REST) shares this pair. Adopted from the AWS-bindings discovery pass, 2026-07-11.",
    "usedEndpoints": []
  },
  {
    "from": "svc-search",
    "to": "svc-pos",
    "sdkPackage": "serverless stream event → posDynamoDBStream (DynamoDB stream)",
    "communicationType": "async",
    "protocol": "cdc",
    "authType": "internal",
    "description": "ComputePosTransactionsJob/ComputePosForecastsJob consume svc-pos's DynamoDB table stream ('Change data capture for svcPos Transactions/Forecasts table') to index POS data into the search Mongo hub — no API call. Adopted from the AWS-bindings discovery pass, 2026-07-11.",
    "usedEndpoints": []
  },
  {
    "from": "svc-trackers",
    "to": "skello-app",
    "sdkPackage": "serverless stream event → skelloapp-bus (Kinesis, DMS CDC)",
    "communicationType": "async",
    "protocol": "cdc",
    "authType": "internal",
    "description": "Consumes the monolith's DMS CDC backbone (skelloapp-bus Kinesis stream) — the async replication channel alongside its REST SDK reads on the same pair. Adopted from the AWS-bindings discovery pass, 2026-07-11.",
    "usedEndpoints": []
  },
  {
    "from": "svc-users",
    "to": "skello-app",
    "sdkPackage": "serverless stream events → skelloapp-bus + skelloapp-bus-fullload-svcusers (Kinesis, DMS CDC)",
    "communicationType": "async",
    "protocol": "cdc",
    "authType": "internal",
    "description": "Consumes the monolith's DMS CDC backbone (skelloapp-bus) plus a dedicated full-load stream — the inbound replication side of the strangler pattern whose authorizer write-back (REST) and RDS read-replica access share this pair. Adopted from the AWS-bindings discovery pass, 2026-07-11.",
    "usedEndpoints": []
  },
  {
    "from": "svc-workload-plan",
    "to": "skello-app",
    "sdkPackage": "serverless stream event → skelloapp-bus (Kinesis, DMS CDC)",
    "communicationType": "async",
    "protocol": "cdc",
    "authType": "internal",
    "description": "Consumes the monolith's DMS CDC backbone (skelloapp-bus Kinesis stream, two listeners) to keep workload-plan context current. Adopted from the AWS-bindings discovery pass, 2026-07-11.",
    "usedEndpoints": []
  }
])

export default connections
