import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Code layer traced 2026-07-11 — the 2026-06-10 caution note is resolved.
// Signature orchestration lives in the MONOLITH: TriggerWorkflowJob generates
// the PDF (docs-v2), uploads to S3, and drives Yousign DIRECTLY
// (YousignClientService — upload, create request, activate). The legacy
// svc-documents-esignature is still called for STATUS (documents_status on
// the follow-up panel) and re-sends — the live-caller reason it sits on
// decommission watch. The old flow's 'DocuSign lambda' and Postgres
// documents-db never existed (docs-v2 stores metadata in DynamoDB).
const document_generation_esignature: ServiceFlow = ServiceFlowSchema.parse({
  "id": "document-generation-esignature",
  "name": "Document Generation & E-Signature",
  "description": "A manager triggers an e-signature (per-document, or attendance sheets in bulk). RequestEsignaturesController enqueues one Esignatures::TriggerWorkflowJob per signer; the job generates the PDF through svc-documents-v2 (attendance-sheet GenerateService / document fetch), uploads it to S3, and orchestrates Yousign directly — upload, signature-request creation, activation (YousignClientService). The follow-up panel polls signature state through the LEGACY svc-documents-esignature (POST /documents_status, with document info from the documents-v1 surface) — the live call that keeps that service on decommission watch. Separately, uploading a document to an employee (Users::DocumentsController#create) notifies them through comms-v2 (NEW_DOCUMENT email + mobile notification).",
  "trigger": {"actor": "manager", "role": "HR"},
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST bulk_create (attendance sheets) / trigger_document_esignature — start e-signature"
    },
    {
      "from": "skello-app",
      "to": "svc-documents-v2",
      "action": "Generate the PDF / fetch the document (DocumentsV2Service print · get_document)"
    },
    {
      "from": "skello-app",
      "to": "svc-documents-esignature",
      "action": "POST /documents_status — signature follow-up panel (legacy service, live caller)"
    },
    {
      "from": "skello-app",
      "to": "svc-communications-v2",
      "action": "NEW_DOCUMENT email + mobile notification on employee-document upload"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-des-esign-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::RequestEsignaturesController",
      "path": "app/controllers/v3/api/request_esignatures_controller.rb",
      "description": "#bulk_create enqueues one TriggerWorkflowJob per user (ATTENDANCESHEET flow); #trigger_document_esignature does the same for a single document; #resend_* goes through the legacy esignature service"
    },
    {
      "id": "cu-des-docs-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::Users::DocumentsController",
      "path": "app/controllers/v3/api/users/documents_controller.rb",
      "description": "Employee-document CRUD (documents-v1 surface) + #docs_signatures_follow_up (the polling panel) + NEW_DOCUMENT notifications via CommunicationsV2 on upload"
    },
    {
      "id": "cu-des-workflow-job",
      "service": "skello-app",
      "kind": "job",
      "label": "Esignatures::TriggerWorkflowJob",
      "path": "app/jobs/esignatures/trigger_workflow_job.rb",
      "description": "The signature workflow: generate/fetch the PDF, upload to S3 (Aws::UploadFileToS3Service), then Yousign upload → create signature request → activate"
    },
    {
      "id": "cu-des-generate",
      "service": "skello-app",
      "kind": "service",
      "label": "Esignatures::AttendanceSheets::GenerateService",
      "path": "app/services/esignatures/attendance_sheets/generate_service.rb",
      "description": "Builds the attendance-sheet PDF through the docs-v2 generation surface"
    },
    {
      "id": "cu-des-yousign",
      "service": "skello-app",
      "kind": "service",
      "label": "Esignatures::YousignRequestEsignatureService",
      "path": "app/services/esignatures/yousign_request_esignature_service.rb",
      "description": "Direct Yousign API orchestration (YousignClientService): upload_pdf_to_yousign, create_signature_request, activate_signature_request"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-des-esign-controller",
      "label": "start e-signature (bulk or single document)",
      "mode": "sync"
    },
    {
      "from": "cu-des-esign-controller",
      "to": "cu-des-workflow-job",
      "label": "Esignatures::TriggerWorkflowJob.perform_later (per signer)",
      "mode": "async-job"
    },
    {
      "from": "cu-des-workflow-job",
      "to": "cu-des-generate",
      "label": "Esignatures::AttendanceSheets::GenerateService",
      "mode": "sync",
      "condition": "ATTENDANCESHEET flow"
    },
    {
      "from": "cu-des-generate",
      "to": "svc-documents-v2",
      "label": "DocumentsV2Service print/generate",
      "mode": "sync"
    },
    {
      "from": "cu-des-workflow-job",
      "to": "svc-documents-v2",
      "label": "DocumentsV2Service get_document",
      "mode": "sync",
      "condition": "DOCUMENT flow"
    },
    {
      "from": "cu-des-workflow-job",
      "to": "s3-des-pdfs",
      "label": "Aws::UploadFileToS3Service",
      "mode": "sync",
      "crud": ["create"]
    },
    {
      "from": "cu-des-workflow-job",
      "to": "cu-des-yousign",
      "label": "Esignatures::YousignRequestEsignatureService",
      "mode": "sync"
    },
    {
      "from": "skello-app-front",
      "to": "cu-des-docs-controller",
      "label": "signature follow-up panel / employee document upload",
      "mode": "sync"
    },
    {
      "from": "cu-des-docs-controller",
      "to": "svc-documents-esignature",
      "label": "Microservices::EsignatureService POST /documents_status",
      "mode": "sync"
    },
    {
      "from": "cu-des-docs-controller",
      "to": "svc-communications-v2",
      "label": "CommunicationsV2 NEW_DOCUMENT (email + mobile)",
      "mode": "sync",
      "condition": "upload for another user who receives document notifications"
    }
  ],
  "infraNodes": [
    {
      "id": "s3-des-pdfs",
      "type": "s3",
      "label": "signature PDFs (S3)",
      "description": "Staging for the PDF handed to Yousign"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "s3-des-pdfs",
      "label": "PDF upload",
      "crud": ["create"]
    }
  ]
})

export default document_generation_esignature
