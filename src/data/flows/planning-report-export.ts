import { ServiceFlowSchema } from '../schemas'
import type { ServiceFlow } from '../schemas'

const planning_report_export: ServiceFlow = ServiceFlowSchema.parse({
  "id": "planning-report-export",
  "name": "Planning Report Export",
  "description": "A manager triggers a planning report export. svc-reports creates an async job, pulls planning data from the monolith and shift details from svc-shifts, generates the report file via a Lambda, uploads it to S3, and returns a pre-signed download URL when the frontend polls for completion.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-reports",
      "action": "POST /reports — trigger planning report export for the selected period"
    },
    {
      "from": "svc-reports",
      "to": "skello-app",
      "action": "GET /v3/planning/export — fetch planning data (shifts, employees, hours) for the period"
    },
    {
      "from": "svc-reports",
      "to": "svc-shifts",
      "action": "POST /shift-details — fetch detailed shift metrics for the report"
    },
    {
      "from": "skello-app-front",
      "to": "svc-reports",
      "action": "GET /reports/{jobId} — poll for report job completion"
    },
    {
      "from": "svc-reports",
      "to": "skello-app-front",
      "action": "200 {signedUrl} — return pre-signed S3 URL for report download"
    }
  ],
  "infraNodes": [
    {
      "id": "dynamo-reports-jobs",
      "type": "dynamodb",
      "label": "svcReports-{env}",
      "description": "Report job state — tracks pending, processing, complete and failed exports"
    },
    {
      "id": "pg-skello-report-export",
      "type": "postgresql",
      "label": "skello_production",
      "description": "Planning data source — shifts, employees and schedules pulled for the export"
    },
    {
      "id": "mongo-shifts-export",
      "type": "mongodb",
      "label": "svc-shifts",
      "description": "Detailed shift metrics included in the report"
    },
    {
      "id": "s3-reports",
      "type": "s3",
      "label": "skello-reports-{env}",
      "description": "Report file storage — completed files uploaded here and accessed via pre-signed URLs"
    },
    {
      "id": "lambda-report-gen",
      "type": "lambda",
      "label": "report-generator",
      "description": "Async Lambda that generates the report file and uploads it to S3"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-reports",
      "to": "dynamo-reports-jobs",
      "label": "create job"
    },
    {
      "from": "skello-app",
      "to": "pg-skello-report-export",
      "label": "read planning data"
    },
    {
      "from": "svc-shifts",
      "to": "mongo-shifts-export",
      "label": "read shifts"
    },
    {
      "from": "svc-reports",
      "to": "lambda-report-gen",
      "label": "invoke async"
    },
    {
      "from": "lambda-report-gen",
      "to": "s3-reports",
      "label": "upload report"
    },
    {
      "from": "svc-reports",
      "to": "dynamo-reports-jobs",
      "label": "update status"
    },
    {
      "from": "svc-reports",
      "to": "s3-reports",
      "label": "generate signed URL"
    }
  ]
})

export default planning_report_export
