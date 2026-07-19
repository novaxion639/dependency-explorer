import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Flow inventory candidate #6 (integrations/payroll domain). Traced 2026-06-15
// in svc-payroll: SyncOrchestratorManager / FinalizeSyncManager /
// HandleEvpReadyManager. Distinct from planning-report-export (the monolith's
// Sidekiq report generation shaped by svc-reports PAM configs): THIS flow is
// the payroll-software sync — currently one provider, A3 Innuva Nomina
// (Spain). The France-side Silae path runs through the Fortify cluster on
// svc-employees (GLOBAL board), outside this flow.
const payroll_export: ServiceFlow = ServiceFlowSchema.parse({
  "id": "payroll-export",
  "name": "Payroll Software Sync",
  "description": "A manager configures the Pay Partners integration (variable pay elements and export template — the front's svc_payroll_client) and triggers a sync. svc-payroll's orchestrator loads the provider config, template mappings and company mappings (provider today: A3 Innuva Nomina, Spain), pulls employee data from svc-hris, processes EVPs through ready/failure handlers, and on finalisation notifies the manager through svc-communications-v2. Sync state and per-run EVP results live in the service's DynamoDB.",
  "trigger": {"actor": "manager", "role": "payroll"},
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-payroll",
      "action": "Configure Pay Partners (GET /v1/evps, template) + trigger sync (POST /v1/sync/trigger, poll /v1/sync/status)"
    },
    {
      "from": "svc-payroll",
      "to": "svc-hris",
      "action": "Pull employee/HRIS data for the export (existing verified edge)"
    },
    {
      "from": "svc-payroll",
      "to": "svc-communications-v2",
      "action": "Sync completion/failure notification (SvcCommunicationRepository from FinalizeSyncManager)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-pe-orchestrator",
      "service": "svc-payroll",
      "kind": "manager",
      "label": "SyncOrchestratorManager",
      "path": "src/Manager/SyncOrchestratorManager.ts",
      "description": "Loads provider config, template mappings and company mappings (GSI by organisation + provider; providerKey hardcoded A3INNUVA until a second provider lands) and drives the sync run"
    },
    {
      "id": "cu-pe-evp-ready",
      "service": "svc-payroll",
      "kind": "manager",
      "label": "HandleEvpReadyManager",
      "path": "src/Manager/HandleEvpReadyManager.ts",
      "description": "Processes computed variable pay elements as they become ready; failures route to HandleEvpFailureManager"
    },
    {
      "id": "cu-pe-finalize",
      "service": "svc-payroll",
      "kind": "manager",
      "label": "FinalizeSyncManager",
      "path": "src/Manager/FinalizeSyncManager.ts",
      "description": "Closes the sync run (SyncRun/SyncRunVpe repositories) and sends the outcome notification via SvcCommunicationRepository"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-pe-orchestrator",
      "label": "POST /v1/sync/trigger",
      "mode": "sync"
    },
    {
      "from": "cu-pe-orchestrator",
      "to": "dynamo-payroll",
      "label": "provider config + mappings + sync run",
      "mode": "sync",
      "crud": ["read", "create"]
    },
    {
      "from": "cu-pe-orchestrator",
      "to": "svc-hris",
      "label": "pull employee data",
      "mode": "sync"
    },
    {
      "from": "cu-pe-evp-ready",
      "to": "dynamo-payroll",
      "label": "per-run EVP results",
      "mode": "sync",
      "crud": ["create", "update"]
    },
    {
      "from": "cu-pe-finalize",
      "to": "dynamo-payroll",
      "label": "close sync run",
      "mode": "sync",
      "crud": ["update"]
    },
    {
      "from": "cu-pe-finalize",
      "to": "svc-communications-v2",
      "label": "outcome notification",
      "mode": "sync"
    }
  ],
  "infraNodes": [
    {
      "id": "dynamo-payroll",
      "type": "dynamodb",
      "label": "svcPayroll-{env}",
      "description": "Provider configs, template/company mappings, sync runs and per-run EVP results"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-payroll",
      "to": "dynamo-payroll",
      "label": "sync state",
      "crud": ["create", "read", "update"]
    }
  ]
})

export default payroll_export
