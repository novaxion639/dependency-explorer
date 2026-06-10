import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

const planning_report_export: ServiceFlow = ServiceFlowSchema.parse({
  "id": "planning-report-export",
  "name": "Planning Report Export",
  "description": "A manager exports a planning/payroll report. The report is generated inside the monolith via an async Sidekiq job reading planning data from PostgreSQL; svc-reports provides the payroll-export configuration (PAM configs, payroll software definitions) that shapes the export. (Corrected 2026-06-10: the previously documented architecture — svc-reports job queue with POST /reports, polling, S3 pre-signed URLs and svc-shifts pulls — had no basis in code. svc-reports' real API is payroll-export configuration, read by the monolith's Microservices::ReportService; the svc-reports→svc-shifts connection was retired.)",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "Trigger planning export (Rails) — report generated monolith-side via async Sidekiq job"
    },
    {
      "from": "skello-app",
      "to": "svc-reports",
      "action": "GET /v1/pam-configs/{id} — read payroll export configuration (Microservices::ReportService)"
    },
    {
      "from": "skello-app",
      "to": "skello-app-front",
      "action": "Download — generated report file delivered once the Sidekiq job completes"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-report-export",
      "type": "postgresql",
      "label": "skello_production",
      "description": "Planning data source — shifts, employees and schedules read for the export"
    },
    {
      "id": "redis-sidekiq-export",
      "type": "redis",
      "label": "skello-redis",
      "description": "Sidekiq broker for the async export generation job"
    },
    {
      "id": "dynamo-reports-configs",
      "type": "dynamodb",
      "label": "svcReports-{env}",
      "description": "Payroll-export configuration store (PAM configs, payroll software definitions)"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-skello-report-export",
      "label": "read planning data",
      "crud": ["read"]
    },
    {
      "from": "skello-app",
      "to": "redis-sidekiq-export",
      "label": "enqueue export job"
    },
    {
      "from": "svc-reports",
      "to": "dynamo-reports-configs",
      "label": "read configs",
      "crud": ["read"]
    }
  ]
})

export default planning_report_export
