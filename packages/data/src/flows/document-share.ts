import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// P2 coverage arc, traced 2026-07-20. Plain document upload+share — distinct
// from payslip dispatch (MODIFY events) and esignature (Signature managers).
const document_share: ServiceFlow = ServiceFlowSchema.parse({
  "id": "document-share",
  "name": "Document Upload & Share",
  "description": "A manager uploads a document to an employee from the Documents tab. The bytes NEVER touch the monolith: the front asks svc-documents-v2 for a presigned URL (POST /documents writes a DOCUMENT_IN_PROGRESS DynamoDB row, TTL 24h, presigned PUT expiry 300s) and PUTs the file straight to S3. S3 ObjectCreated promotes the in-progress row to a permanent DOCUMENT (empty 0-byte uploads are dropped; an abandoned upload just TTLs away). 'Sharing' is implicit — the DOCUMENT carries the target employeeId, and the DynamoDB-stream INSERT (filtered: creatorId+employeeId present, no svcDocV1Id/deletedAt) drives the notification: email + Expo push via svc-communications-v2, gated on creator ≠ employee AND the employee's opt-in; the payslip folder is filtered OUT of this pipeline (payslip dispatch rides MODIFY events under dispatchPayslipOnlyToV2). A best-effort EMPLOYEE_DOCUMENT_UPLOADED activity event fires from the front to svc-events, independent of the notification chain. Upload quota: 5 files premium, 1 otherwise (maxDocumentAllowedPerUser).",
  "trigger": { "actor": "manager", "role": "canManagedEmployeeOrSelfDocuments (svc-documents-v2 permission)" },
  "links": [
    { "to": "payslip-dispatch", "kind": "domain-related", "note": "same DOCUMENT entity and stream machinery — payslips ride MODIFY events (svc-intelligence sets employeeId) and are filtered out of this INSERT pipeline" },
    { "to": "mobile-documents-payslips", "kind": "continuation", "note": "the Expo push lands the employee in the mobile Documents tab" }
  ],
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-documents-v2",
      "action": "POST /documents (presigned create, DIRECT) → PUT file bytes to S3 presigned URL"
    },
    {
      "from": "svc-documents-v2",
      "to": "svc-communications-v2",
      "action": "Employee notification — email + Expo push (stream-driven, creator ≠ employee + opt-in)"
    },
    {
      "from": "skello-app-front",
      "to": "svc-events",
      "action": "EMPLOYEE_DOCUMENT_UPLOADED activity (best-effort, after uploads)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-ds-modal",
      "service": "skello-app-front",
      "kind": "component",
      "label": "CreateDocumentModal",
      "path": "apps/vue-app/src/users/pages/documents/CreateDocumentModal/index.vue",
      "description": "Upload modal — mime/size/count validation, per-file title + expiration, presigned create then direct S3 PUT"
    },
    {
      "id": "cu-ds-client",
      "service": "skello-app-front",
      "kind": "client",
      "label": "svcDocumentV2Client",
      "path": "apps/vue-app/src/shared/utils/clients/svc_document_v2_client.js",
      "description": "svc-documents-v2-client instance — .create POST /documents, .upload PUT to the presigned URL; clientSource skelloApp:web"
    },
    {
      "id": "cu-ds-controller",
      "service": "svc-documents-v2",
      "kind": "controller",
      "label": "DocumentsApiController",
      "path": "src/Controller/DocumentsApiController.ts",
      "description": "createAction — DocumentPermission.grantAccessCreateAction (canManagedEmployeeOrSelfDocuments) then batchCreate"
    },
    {
      "id": "cu-ds-inprogress-mgr",
      "service": "svc-documents-v2",
      "kind": "manager",
      "label": "DocumentInProgressManager",
      "path": "src/Manager/DocumentInProgressManager.ts",
      "description": "batchCreate — DOCUMENT_IN_PROGRESS row (TTL +24h) + S3 presigned PUT (300s)"
    },
    {
      "id": "cu-ds-s3-listener",
      "service": "svc-documents-v2",
      "kind": "job",
      "label": "S3FileListenerJobHandler",
      "path": "src/Handler/Job/S3FileListenerJobHandler.ts",
      "description": "S3 ObjectCreated → promotes in-progress to DOCUMENT (DocumentManager.upsert), drops 0-byte uploads, deletes the in-progress row"
    },
    {
      "id": "cu-ds-doc-mgr",
      "service": "svc-documents-v2",
      "kind": "manager",
      "label": "DocumentManager",
      "path": "src/Manager/DocumentManager.ts",
      "description": "DOCUMENT upsert into DynamoDB"
    },
    {
      "id": "cu-ds-notify-handler",
      "service": "svc-documents-v2",
      "kind": "job",
      "label": "NotifyEmployeeHandler",
      "path": "src/Handler/Job/NotifyEmployeeHandler.ts",
      "description": "Dynamo-stream consumer (INSERT DOCUMENT, creatorId+employeeId, no svcDocV1Id/deletedAt) — rethrows on comms error (DLQ-backed)"
    },
    {
      "id": "cu-ds-employee-mgr",
      "service": "svc-documents-v2",
      "kind": "manager",
      "label": "EmployeeManager",
      "path": "src/Manager/EmployeeManager.ts",
      "description": "notifyOnNewDocument — creator ≠ employee gate + receivesDocumentNotification opt-in; payslip folder skipped"
    },
    {
      "id": "cu-ds-notify-mgr",
      "service": "svc-documents-v2",
      "kind": "manager",
      "label": "NotifyEmployeeManager",
      "path": "src/Manager/NotifyEmployeeManager.ts",
      "description": "Builds the email + push DTOs, calls the comms SDK repositories (createLowPriority)"
    }
  ],
  "codeEdges": [
    { "from": "cu-ds-modal", "to": "cu-ds-client", "label": "create + upload per file", "mode": "sync" },
    { "from": "cu-ds-client", "to": "svc-documents-v2", "label": "POST /documents (presigned create)", "mode": "sync" },
    { "from": "cu-ds-client", "to": "s3-documents", "label": "PUT bytes to presigned URL (bypasses every service)", "mode": "sync", "crud": ["create"] },
    { "from": "svc-documents-v2", "to": "cu-ds-controller", "label": "documents routes", "mode": "sync" },
    { "from": "cu-ds-controller", "to": "cu-ds-inprogress-mgr", "label": "batchCreate", "mode": "sync", "crud": ["create"] },
    { "from": "cu-ds-inprogress-mgr", "to": "dynamo-documents", "label": "DOCUMENT_IN_PROGRESS (TTL 24h)", "mode": "sync", "crud": ["create"] },
    { "from": "s3-documents", "to": "cu-ds-s3-listener", "label": "ObjectCreated", "mode": "async-event", "condition": "size > 0 (empty uploads dropped)" },
    { "from": "cu-ds-s3-listener", "to": "cu-ds-doc-mgr", "label": "promote in-progress → DOCUMENT", "mode": "sync", "crud": ["create", "update", "delete"] },
    { "from": "cu-ds-doc-mgr", "to": "dynamo-documents", "label": "DOCUMENT upsert", "mode": "sync", "crud": ["create", "update"] },
    {
      "from": "dynamo-documents", "to": "cu-ds-notify-handler", "label": "stream INSERT (filter: creator+employee, no v1 id, not deleted)",
      "mode": "async-event",
      "failure": { "queue": "NotifyEmployeeJob", "dlq": "NotifyEmployeeJobDlq", "onError": "A dead-lettered record means the employee never hears about the document — the document itself is safely stored" }
    },
    { "from": "cu-ds-notify-handler", "to": "cu-ds-employee-mgr", "label": "notifyOnNewDocument", "mode": "sync", "condition": "creator ≠ employee AND receivesDocumentNotification; payslip folder skipped" },
    { "from": "cu-ds-employee-mgr", "to": "cu-ds-notify-mgr", "label": "email + push DTOs", "mode": "sync" },
    { "from": "cu-ds-notify-mgr", "to": "svc-communications-v2", "label": "emailRepository + notificationRepository.createLowPriority", "mode": "async-job", "failure": { "queue": "bulkCreateNotificationLowPrioritySqs", "dlq": "bulkCreateNotificationLowPriorityDlq", "onError": "A dead-lettered notification batch means the employee is not told about the document; the handler rethrows so its own DLQ catches the record too" } },
    { "from": "cu-ds-modal", "to": "svc-events", "label": "EMPLOYEE_DOCUMENT_UPLOADED (best-effort)", "mode": "async-event", "failure": { "dlqAbsent": "confirmed-missing", "onError": "Best-effort browser call — a lost event silently misses the activity log; the document and its notification are unaffected" } }
  ],
  "infraNodes": [
    { "id": "s3-documents", "type": "s3", "label": "documents bucket (presigned PUT/GET)", "description": "Document blobs — the front writes directly; ObjectCreated drives promotion" },
    { "id": "dynamo-documents", "type": "dynamodb", "label": "svc-documents-v2 single-table (+stream)", "description": "DOCUMENT_IN_PROGRESS (TTL) + DOCUMENT entities; the stream INSERT filter drives employee notification" }
  ],
  "infraEdges": [
    { "from": "skello-app-front", "to": "s3-documents", "label": "direct presigned PUT", "crud": ["create"] },
    { "from": "svc-documents-v2", "to": "dynamo-documents", "label": "two-phase document rows", "crud": ["create", "update", "delete"] }
  ]
})

export default document_share
