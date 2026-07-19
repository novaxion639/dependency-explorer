import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Code layer traced 2026-07-11: ReportsController#excel_report → Sidekiq
// (ExportExcelParallelJob under the batch-mode FF, ExportReportJob
// otherwise) → Report::XlsxCreator → upload to the temporary-assets S3
// bucket → presigned URL pushed over the monolith's OWN ActionCable channel
// (report_export_channel_{user}{stream}) — not svc-websockets. The same
// temporary-assets bucket is the one svc-reports listens on for automated
// PAM report dispatch (see the svc-reports service entry).
const planning_report_export: ServiceFlow = ServiceFlowSchema.parse({
  "id": "planning-report-export",
  "name": "Planning Report Export",
  "description": "A manager exports the planning/payroll Excel report. ReportsController#excel_report saves the user's report preferences, resolves the date interval and enqueues the export: ExportExcelParallelJob (Sidekiq, batch-mode feature flag) or ExportReportJob. The job builds the workbook with Report::XlsxCreator from PostgreSQL planning data, uploads it to the temporary-assets S3 bucket and streams progress + the presigned download URL over the monolith's own ActionCable channel. svc-reports is NOT in the generation path — it provides payroll-export configuration (PAM configs via Microservices::ReportService) used by the payroll-integration transforms on the same controller.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST excel_report — trigger the export (stream_id for progress)"
    },
    {
      "from": "skello-app",
      "to": "svc-reports",
      "action": "GET /v1/pam-configs/{id} — payroll-export configuration (PamConfigTransformService)"
    },
    {
      "from": "skello-app",
      "to": "skello-app-front",
      "action": "ActionCable progress + presigned S3 download URL (report_export_channel)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-exp-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::ReportsController#excel_report",
      "path": "app/controllers/v3/api/reports_controller.rb",
      "description": "Persists report preferences (Users::UserReportPreferencesUpdater), resolves dates (ReportDateIntervalResolver), and enqueues the export job; includes PamConfigTransformService for the payroll-integration surface"
    },
    {
      "id": "cu-exp-parallel-job",
      "service": "skello-app",
      "kind": "job",
      "label": "Report::ExportExcelParallelJob",
      "path": "app/jobs/report/export_excel_parallel_job.rb",
      "description": "Sidekiq batch-mode export (FF FEATUREDEV_EXCEL_REPORT_EXPORT_BATCH_MODE); also reused by send_shop_report without a WebSocket stream"
    },
    {
      "id": "cu-exp-job",
      "service": "skello-app",
      "kind": "job",
      "label": "Report::ExportReportJob",
      "path": "app/jobs/report/export_report_job.rb",
      "description": "Legacy-path export job: builds, uploads to AWS_TEMPORARY_BUCKET, and broadcasts progress/URL on report_export_channel_{user}{stream}"
    },
    {
      "id": "cu-exp-xlsx",
      "service": "skello-app",
      "kind": "service",
      "label": "Report::XlsxCreator",
      "path": "app/services/report/xlsx_creator.rb",
      "description": "Builds the workbook from the shop's planning data with per-step progress callbacks"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-exp-controller",
      "label": "POST excel_report",
      "mode": "sync"
    },
    {
      "from": "cu-exp-controller",
      "to": "cu-exp-parallel-job",
      "label": "Report::ExportExcelParallelJob.perform_async",
      "mode": "async-job",
      "condition": "FF: FEATUREDEV_EXCEL_REPORT_EXPORT_BATCH_MODE",
      "flags": [{ "name": "FEATUREDEV_EXCEL_REPORT_EXPORT_BATCH_MODE", "kind": "dev" }]
    },
    {
      "from": "cu-exp-controller",
      "to": "cu-exp-job",
      "label": "Report::ExportReportJob.perform_later",
      "mode": "async-job",
      "condition": "batch mode off"
    },
    {
      "from": "cu-exp-controller",
      "to": "svc-reports",
      "label": "Microservices::ReportService — PAM configs",
      "mode": "sync",
      "condition": "payroll-integration exports"
    },
    {
      "from": "cu-exp-job",
      "to": "cu-exp-xlsx",
      "label": "Report::XlsxCreator.run",
      "mode": "sync"
    },
    {
      "from": "cu-exp-xlsx",
      "to": "pg-report-export",
      "label": "read planning data for the period",
      "mode": "sync",
      "crud": ["read"]
    },
    {
      "from": "cu-exp-job",
      "to": "s3-temporary-assets",
      "label": "AWS::S3Manager upload + presigned URL",
      "mode": "sync",
      "crud": ["create"]
    }
  ],
  "infraNodes": [
    {
      "id": "pg-report-export",
      "type": "postgresql",
      "label": "skello_production",
      "description": "Planning data read for the workbook"
    },
    {
      "id": "s3-temporary-assets",
      "type": "s3",
      "label": "skello-app.temporary-assets",
      "description": "Export staging: presigned download links; the same bucket svc-reports listens on for automated PAM report dispatch"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-report-export",
      "label": "planning reads",
      "crud": ["read"]
    },
    {
      "from": "skello-app",
      "to": "s3-temporary-assets",
      "label": "report upload",
      "crud": ["create"]
    }
  ]
})

export default planning_report_export
