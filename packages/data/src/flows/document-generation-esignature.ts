import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Code layer traced 2026-10-03 at skello-app 3f6728f and svc-documents-v2 e1a175a: the monolith
// hands signature work to svc-documents-v2, which holds the Yousign client.
const document_generation_esignature: ServiceFlow = ServiceFlowSchema.parse({
  "id": "document-generation-esignature",
  "name": "Document Generation & E-Signature",
  "description": "A manager triggers an e-signature (per document, or attendance sheets in bulk). RequestEsignaturesController enqueues one Esignatures::TriggerWorkflowJob per signer. For attendance sheets, the job renders each sheet through svc-documents-v2's generate endpoint with the e-signature data (signers, initials) attached. For an existing document, it reads the document's signers from svc-documents-v2 and posts the e-signature event on the skelloApp-puma-documentsV2-workflow SQS queue, which svc-documents-v2's createSignatureRecordJob consumes. svc-documents-v2 records the signature request and holds the Yousign client; skello-app makes no Yousign call.",
  "trigger": {"actor": "manager", "role": "HR"},
  "primaryArea": "documents-esignature",
  "chapters": [
    { "title": "A manager requests signatures", "summary": "The front starts an e-signature for one document or for attendance sheets in bulk; one background job runs per signer.", "refs": ["skello-app-front", "skello-app", "cu-des-esign-controller"] },
    { "title": "Attendance sheets are generated", "summary": "For attendance sheets, the job has svc-documents-v2 render each sheet with its signers attached.", "refs": ["cu-des-workflow-job", "cu-des-generate", "svc-documents-v2"] },
    { "title": "Documents go to the workflow queue", "summary": "For an existing document, the job reads its signers and posts the e-signature event on svc-documents-v2's workflow queue.", "refs": ["cu-des-workflow-job", "sqs-des-workflow"] },
    { "title": "svc-documents-v2 runs the signature", "summary": "svc-documents-v2 consumes the queue, records the signature request and holds the Yousign client.", "refs": ["sqs-des-workflow", "svc-documents-v2"] }
  ],
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST bulk_create (attendance sheets) / trigger_document_esignature — start e-signature"
    },
    {
      "from": "skello-app",
      "to": "svc-documents-v2",
      "action": "Generate the attendance sheet with e-signature data (DocumentsV2Service.generate) · read a document's signers and post its workflow event on skelloApp-puma-documentsV2-workflow"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-des-esign-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::RequestEsignaturesController",
      "path": "app/controllers/v3/api/request_esignatures_controller.rb",
      "description": "#bulk_create enqueues one TriggerWorkflowJob per user (ATTENDANCESHEET flow); #trigger_document_esignature enqueues one for a single document (DOCUMENT flow). Both sit behind the e-signature permissions and the e-signature maintenance switch"
    },
    {
      "id": "cu-des-workflow-job",
      "service": "skello-app",
      "kind": "job",
      "label": "Esignatures::TriggerWorkflowJob",
      "path": "app/jobs/esignatures/trigger_workflow_job.rb",
      "description": "Validates the flow, builds the e-signature event (signers with Yousign-supported locales, initials, end date), then renders the attendance sheet in svc-documents-v2 (ATTENDANCESHEET) or sends the event on the documents-v2 workflow queue (DOCUMENT, signers read from the v2 document)"
    },
    {
      "id": "cu-des-generate",
      "service": "skello-app",
      "kind": "service",
      "label": "Microservices::GenerateDocuments::AttendanceSheetsPdf",
      "path": "app/services/microservices/generate_documents/attendance_sheets_pdf.rb",
      "description": "Builds the attendance-sheet payload and calls DocumentsV2Service.generate with the e-signature data (signers, initials) — generate_in_svc_v2"
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
      "label": "AttendanceSheetsPdf#generate_in_svc_v2",
      "mode": "sync",
      "condition": "ATTENDANCESHEET flow"
    },
    {
      "from": "cu-des-generate",
      "to": "svc-documents-v2",
      "label": "DocumentsV2Service.generate (e-signature data)",
      "mode": "sync"
    },
    {
      "from": "cu-des-workflow-job",
      "to": "svc-documents-v2",
      "label": "DocumentsV2Service.get_document (signers)",
      "mode": "sync",
      "condition": "DOCUMENT flow"
    },
    {
      "from": "cu-des-workflow-job",
      "to": "sqs-des-workflow",
      "label": "SQSClient.send_message — e-signature event",
      "mode": "async-job",
      "crud": ["create"],
      "condition": "DOCUMENT flow"
    },
    {
      "from": "sqs-des-workflow",
      "to": "svc-documents-v2",
      "label": "createSignatureRecordJob",
      "mode": "async-event"
    }
  ],
  "infraNodes": [
    {
      "id": "sqs-des-workflow",
      "type": "sqs",
      "label": "skelloApp-puma-documentsV2-workflow",
      "resources": ["sqs:skelloApp-puma-documentsV2-workflow"],
      "description": "E-signature events for existing documents, consumed by svc-documents-v2's createSignatureRecordJob"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "sqs-des-workflow",
      "label": "workflow message",
      "crud": ["create"]
    }
  ]
})
export default document_generation_esignature
