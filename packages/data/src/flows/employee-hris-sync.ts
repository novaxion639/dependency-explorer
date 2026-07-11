import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Code layer traced 2026-07-11 — the sync's real trigger is the HRIS side:
// Kombo (the HRIS integration platform) fires webhooks into svc-hris;
// SyncManager pulls Skello's employees from svc-employees to MATCH/diff,
// then dispatches UpsertEmployeeFromHrisDto messages onto svc-employees'
// queue (UpsertEmployeeJob consumes). Sync errors get a DynamoDB-TTL'd
// trail plus the generate-sync-error-reports schedule (S3 + email) —
// the recurring task discovered in Layer 1.
const employee_hris_sync: ServiceFlow = ServiceFlowSchema.parse({
  "id": "employee-hris-sync",
  "name": "Employee HRIS Sync",
  "description": "An organisation's HRIS (connected through the Kombo integration platform) syncs employees into Skello. Kombo webhooks (sync finished, data changed, integration lifecycle) land on svc-hris; SyncManager pulls the organisation's employees from svc-employees (getEmployeesByOrganisation — the matching/diff base), reads the HRIS-side data through KomboManager, and dispatches one UpsertEmployeeFromHrisDto per changed employee onto svc-employees' upsert queue, where UpsertEmployeeJob applies it. Failed upserts flow through a DLQ handler into SyncError entries (DynamoDB TTL), and the generate-sync-error-reports schedule (cron, Layer-1-discovered recurring task) builds the error report on S3 and mails it via SES directly.",
  "steps": [
    {
      "from": "svc-hris",
      "to": "svc-employees",
      "action": "GET /v1/employees by organisation — matching/diff base, then SQS UpsertEmployeeFromHrisDto per change"
    },
  ],
  "codeUnits": [
    {
      "id": "cu-hs-webhook",
      "service": "svc-hris",
      "kind": "controller",
      "label": "ProcessKomboSyncFinishedWebhookHandler",
      "path": "src/Handler/WebhookHandlers/ProcessKomboSyncFinishedWebhookHandler.ts",
      "description": "Kombo webhook entry — sync-finished (siblings handle data-changed and integration created/deleted/flow-failed)"
    },
    {
      "id": "cu-hs-webhook-manager",
      "service": "svc-hris",
      "kind": "manager",
      "label": "WebhookManager",
      "path": "src/Manager/WebhookManager.ts",
      "description": "Routes each Kombo webhook type to its processing — sync-finished hands over to the sync run"
    },
    {
      "id": "cu-hs-sync-manager",
      "service": "svc-hris",
      "kind": "manager",
      "label": "SyncManager",
      "path": "src/Manager/SyncManager.ts",
      "description": "The sync core: SvcEmployeesRepository.getEmployeesByOrganisation for the matching base, KomboManager for HRIS data, sync sessions in DynamoDB, S3 sync storage, dispatch via EmployeeSqsDispatcher"
    },
    {
      "id": "cu-hs-kombo-manager",
      "service": "svc-hris",
      "kind": "manager",
      "label": "KomboManager",
      "path": "src/Manager/KomboManager.ts",
      "description": "Kombo API client — connection links, HRIS employee data"
    },
    {
      "id": "cu-hs-dispatcher",
      "service": "svc-hris",
      "kind": "service",
      "label": "EmployeeSqsDispatcher",
      "path": "src/Manager/EmployeeSqsDispatcher.ts",
      "description": "Sends one UpsertEmployeeFromHrisDto (svc-employees-client contract) per changed employee to svc-employees' queue"
    },
    {
      "id": "cu-hs-dlq",
      "service": "svc-hris",
      "kind": "job",
      "label": "ProcessDlqUpsertEmployeeHandler",
      "path": "src/Handler/Jobs/ProcessDlqUpsertEmployeeHandler.ts",
      "description": "Turns failed upserts into SyncError entries (DynamoDB entity TTL 10-20 min)"
    },
    {
      "id": "cu-hs-report-job",
      "service": "svc-hris",
      "kind": "job",
      "label": "GenerateSyncErrorsJobHandler",
      "path": "src/Handler/Jobs/GenerateSyncErrorsJobHandler.ts",
      "description": "The generate-sync-error-reports schedule (EventBridge cron) — builds the error report via SyncErrorManager (S3 + email)"
    },
    {
      "id": "cu-hs-sync-error-mgr",
      "service": "svc-hris",
      "kind": "manager",
      "label": "SyncErrorManager",
      "path": "src/Manager/SyncErrorManager.ts",
      "description": "Aggregates the TTL'd sync errors into the report — stored on S3, delivered by email (SES, presigned link)"
    },
    {
      "id": "cu-hs-upsert-job",
      "service": "svc-employees",
      "kind": "job",
      "label": "UpsertEmployeeJob",
      "path": "src/Handler/Job/UpsertEmployeeJob.ts",
      "description": "svc-employees' consumer of the HRIS upsert queue — applies the employee change"
    }
  ],
  "codeEdges": [
    {
      "from": "cu-hs-webhook",
      "to": "cu-hs-webhook-manager",
      "label": "WebhookManager#processSyncFinishedWebhook",
      "mode": "sync"
    },
    {
      "from": "cu-hs-webhook-manager",
      "to": "cu-hs-sync-manager",
      "label": "SyncManager run sync",
      "mode": "sync"
    },
    {
      "from": "cu-hs-sync-manager",
      "to": "svc-employees",
      "label": "SvcEmployeesRepository.getEmployeesByOrganisation",
      "mode": "sync"
    },
    {
      "from": "cu-hs-sync-manager",
      "to": "cu-hs-kombo-manager",
      "label": "KomboManager — HRIS-side data",
      "mode": "sync"
    },
    {
      "from": "cu-hs-sync-manager",
      "to": "dynamo-hris",
      "label": "sync sessions + integration config",
      "mode": "sync",
      "crud": ["create", "read", "update"]
    },
    {
      "from": "cu-hs-sync-manager",
      "to": "cu-hs-dispatcher",
      "label": "EmployeeSqsDispatcher per changed employee",
      "mode": "sync"
    },
    {
      "from": "cu-hs-dispatcher",
      "to": "sqs-hris-upsert",
      "label": "UpsertEmployeeFromHrisDto",
      "mode": "async-job"
    },
    {
      "from": "sqs-hris-upsert",
      "to": "cu-hs-upsert-job",
      "label": "SQS trigger",
      "mode": "async-job"
    },
    {
      "from": "cu-hs-upsert-job",
      "to": "dynamo-employees",
      "label": "apply employee upsert",
      "mode": "sync",
      "crud": ["create", "update"]
    },
    {
      "from": "sqs-hris-upsert",
      "to": "cu-hs-dlq",
      "label": "DLQ on failed upserts",
      "mode": "async-job"
    },
    {
      "from": "cu-hs-dlq",
      "to": "dynamo-hris",
      "label": "SyncError entries (TTL)",
      "mode": "sync",
      "crud": ["create"]
    },
    {
      "from": "cu-hs-report-job",
      "to": "cu-hs-sync-error-mgr",
      "label": "SyncErrorManager report",
      "mode": "sync"
    }
  ],
  "infraNodes": [
    {
      "id": "dynamo-employees",
      "type": "dynamodb",
      "label": "SvcEmployees ({env})",
      "description": "Employee configs and sync state (employee master data lives in the monolith, fronted by private endpoints)"
    },
    {
      "id": "dynamo-hris",
      "type": "dynamodb",
      "label": "svcHris-{env}",
      "description": "HRIS integration credentials, sync sessions, TTL'd sync errors"
    },
    {
      "id": "sqs-hris-upsert",
      "type": "sqs",
      "label": "employee upsert queue",
      "description": "svc-hris → svc-employees upsert channel (UpsertEmployeeFromHrisDto), with a DLQ feeding the sync-error trail"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-hris",
      "to": "dynamo-hris",
      "label": "sync state",
      "crud": ["create", "read", "update"]
    },
    {
      "from": "svc-employees",
      "to": "dynamo-employees",
      "label": "employee upserts",
      "crud": ["create", "update"]
    }
  ]
})

export default employee_hris_sync
