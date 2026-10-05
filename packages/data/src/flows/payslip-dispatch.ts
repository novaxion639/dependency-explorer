import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Flow inventory follow-up (documents domain). Traced in svc-intelligence
// @517de1d, svc-documents-v2 @e1a175a4 and skello-app-front @7cb2125, and
// diffed against the 'Payslip dispatch' FigJam board (8c9T22Sgu9rosbqwrXznCg).
// The browser orchestrates; svc-documents-v2's own stream splits pages and
// requests analysis, svc-intelligence's own stream reports each page result.
const payslip_dispatch: ServiceFlow = ServiceFlowSchema.parse({
  "id": "payslip-dispatch",
  "name": "Payslip Extraction & Dispatch",
  "description": "A manager dispatches a bulk payslip file from the browser. PayslipsDispatchModal creates the file in svc-documents-v2 (POST /documents with toSplit + toAnalyze, 1 h customTTL) and PUTs the bytes to the presigned URL; S3 ObjectCreated promotes it to a DOCUMENT whose customTTL becomes deletedAt. The table's own stream drives the next stages: SplitInPagesJob (INSERT, toSplit=true) cuts the file into one document per page, and AnalyzeDocumentListenerJob fires for each split page (splitted=true AND toAnalyze=true), batch-sending ExtractDataFromDocumentDto to svc-intelligence's queue. The extraction job fetches the page back from svc-documents-v2, converts it to an image and runs LLM extraction on Bedrock (analysisType defaults to PAYSLIPS; field-accuracy limits documented in the service's payslip-limitations doc), storing one LLMResponse per page — a failed page is stored as output '{}' stopReason ERROR. Each LLMResponse INSERT fires NotifyUser, which pushes the page result to the browser over the LEGACY websockets genericMessage queue. The browser matches each page to an employee from GET /v3/api/employees/payslips_managees (identity number, then first and last name, then city and street, then compound name; exactly one employee must match), groups pages into payslips and, once every page has arrived or a watchdog fires (300 s to first page, 60 s idle), calls POST /documents/extract-pages per payslip (rows over 50 pages skipped) to cut each into its own document. On confirm (no e-signature) it posts the matched rows to svc-intelligence's POST /validationResponses (fire-and-forget) and PATCHes /documents, assigning each matched payslip to its employee under /pay_slips and clearing its deletedAt; unmatched payslips are not assigned. That MODIFY fires NotifyEmployeeJob, which emails the employee (NEW_DOCUMENT) and sends an Expo push to /v3/profile/documents via svc-communications-v2, unless the creator is the employee or the employee opted out. svc-intelligence never calls svc-documents-v2 to split or patch.",
  "trigger": {"actor": "manager", "role": "payroll"},
  "primaryArea": "documents-esignature",
  "chapters": [
    { "title": "A payslip file is uploaded", "summary": "The manager's browser creates the file in svc-documents-v2 and uploads it straight to S3; it is stored as a document with a one-hour life.", "refs": ["cu-pd-front-modal", "cu-pd-docs-controller", "cu-pd-inprogress-mgr", "cu-pd-s3-listener", "cu-pd-docs-mgr", "dynamo-docs-v2-pd"] },
    { "title": "The file is split into pages", "summary": "The new document's change stream starts a job that cuts the file into one document per page.", "refs": ["cu-pd-split-handler", "cu-pd-splitter-mgr"] },
    { "title": "Analysis is requested", "summary": "Each page document's change fires a listener that builds an analysis request and batch-sends it to svc-intelligence's queue.", "refs": ["cu-pd-analyze-listener", "cu-pd-extract-mgr", "svc-intelligence"] },
    { "title": "The extraction job starts", "summary": "A queue job takes each page as a payslip analysis and records its state.", "refs": ["cu-pd-handler", "cu-pd-doc-manager", "dynamo-intelligence"] },
    { "title": "The page is fetched", "summary": "svc-intelligence reads the page's content back from svc-documents-v2.", "refs": ["cu-pd-doc-manager", "cu-pd-docs-repo"] },
    { "title": "AI reads each page", "summary": "The page becomes an image and a Claude Haiku model on Bedrock extracts the employee's identity and period; extraction artifacts are kept in MongoDB.", "refs": ["cu-pd-doc-manager", "cu-pd-bedrock", "mongo-intelligence-pd"] },
    { "title": "The user sees progress", "summary": "Each stored page result fires the table's stream, which pushes it over the legacy websockets to the manager's open browser.", "refs": ["dynamo-intelligence", "cu-pd-notify-handler", "cu-pd-notify", "svc-websockets"] },
    { "title": "Pages are matched to employees", "summary": "The browser matches each page to a managed employee by ID number, name, address or compound name, and groups pages into payslips.", "refs": ["cu-pd-front-modal", "cu-pd-front-matching", "skello-app"] },
    { "title": "Each payslip is cut out", "summary": "Once all pages arrive, or the watchdog fires, the browser asks svc-documents-v2 to extract each payslip's pages into its own document.", "refs": ["cu-pd-docs-controller", "cu-pd-splitter-mgr", "cu-pd-inprogress-mgr"] },
    { "title": "The manager confirms", "summary": "On confirm, matched payslips are assigned to their employee in the pay slips folder and keep no expiry; unmatched ones are not assigned.", "refs": ["cu-pd-front-modal", "cu-pd-docs-mgr"] },
    { "title": "Employees are notified", "summary": "The change to each payslip fires a job that emails the employee and sends a push through svc-communications-v2, unless they opted out.", "refs": ["cu-pd-notify-employee-handler", "cu-pd-employee-mgr", "cu-pd-notify-employee-mgr", "svc-communications-v2"] },
    { "title": "Employees find their payslips", "summary": "Each confirmed payslip sits in its employee's pay slips folder in svc-documents-v2.", "refs": ["dynamo-docs-v2-pd"] }
  ],
  "links": [{"to": "mobile-documents-payslips", "kind": "continuation", "note": "dispatched payslips are what employees consume from the mobile Documents tab"}],
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-documents-v2",
      "action": "POST /documents — create the file with toSplit + toAnalyze (1 h customTTL), then PUT the bytes to the presigned URL"
    },
    {
      "from": "svc-documents-v2",
      "to": "svc-intelligence",
      "action": "Analysis request: own-stream listener → ExtractDataFromDocumentDto → extractDataFromDocument SQS"
    },
    {
      "from": "svc-intelligence",
      "to": "svc-documents-v2",
      "action": "Fetch document content for AI processing (existing verified edge)"
    },
    {
      "from": "svc-intelligence",
      "to": "svc-websockets",
      "action": "Per-page extraction result push (websocket-genericMessage — legacy websockets)"
    },
    {
      "from": "svc-websockets",
      "to": "skello-app-front",
      "action": "Per-page extraction result on the Generic websocket"
    },
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "GET /v3/api/employees/payslips_managees — employee pool for matching"
    },
    {
      "from": "skello-app-front",
      "to": "svc-documents-v2",
      "action": "POST /documents/extract-pages — one document per payslip (rows over 50 pages skipped)"
    },
    {
      "from": "skello-app-front",
      "to": "svc-intelligence",
      "action": "POST /validationResponses — matched rows only, fire-and-forget"
    },
    {
      "from": "skello-app-front",
      "to": "svc-documents-v2",
      "action": "PATCH /documents — assign each matched payslip to its employee under /pay_slips, clearing deletedAt"
    },
    {
      "from": "svc-documents-v2",
      "to": "svc-communications-v2",
      "action": "NotifyEmployeeJob on the payslip MODIFY — NEW_DOCUMENT email + Expo push (createLowPriority)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-pd-analyze-listener",
      "service": "svc-documents-v2",
      "kind": "job",
      "label": "AnalyzeDocumentListenerJobHandler",
      "path": "src/Handler/Job/AnalyzeDocumentListenerJobHandler.ts",
      "description": "Consumes svc-documents-v2's own DynamoDB stream — the INSERT of each split page marked for analysis — and builds the analysis requests"
    },
    {
      "id": "cu-pd-extract-mgr",
      "service": "svc-documents-v2",
      "kind": "manager",
      "label": "DocumentExtractDataManager",
      "path": "src/Manager/DocumentExtractDataManager.ts",
      "description": "Builds ExtractDataFromDocumentDto (svc-intelligence-sdk) and batch-sends to svcIntelligenceExtractDataFromDocumentSqsURL"
    },
    {
      "id": "cu-pd-handler",
      "service": "svc-intelligence",
      "kind": "job",
      "label": "ExtractDataFromDocumentHandler",
      "path": "src/Handler/Jobs/ExtractDataFromDocumentHandler.ts",
      "description": "SQS-triggered extraction job, one message per page — analysisType defaults to PAYSLIPS; upserts one LLMResponse per page, and a fallback LLMResponse (output '{}', stopReason ERROR) when extraction fails so the page is still counted."
    },
    {
      "id": "cu-pd-doc-manager",
      "service": "svc-intelligence",
      "kind": "manager",
      "label": "DocumentManager",
      "path": "src/Manager/DocumentManager.ts",
      "description": "Orchestrates the extraction: fetches the source document (DocumentRepository), prepares page images (ConvertPdfToImageManager) and runs the Bedrock extraction"
    },
    {
      "id": "cu-pd-notify-handler",
      "service": "svc-intelligence",
      "kind": "job",
      "label": "NotifyUserHandler",
      "path": "src/Handler/Jobs/NotifyUserHandler.ts",
      "description": "Triggered by the intelligence table's own DynamoDB stream (INSERT of LLMResponse entities, questionScope filter incl. PAYSLIPS) — delivers each page result through NotifyUserManager"
    },
    {
      "id": "cu-pd-bedrock",
      "service": "svc-intelligence",
      "kind": "manager",
      "label": "BedrockLlmProvider",
      "path": "src/Client/Llm/BedrockLlmProvider.ts",
      "description": "LLM extraction on AWS Bedrock Converse — the PAYSLIPS provider (Claude Haiku 4.5) in ExtractionManager's provider map, reached from DocumentManager after ConvertPdfToImageManager prepares the page images"
    },
    {
      "id": "cu-pd-docs-repo",
      "service": "svc-intelligence",
      "kind": "service",
      "label": "DocumentRepository",
      "path": "src/Repository/DocumentRepository.ts",
      "description": "svc-documents-v2 client — fetches the source document content"
    },
    {
      "id": "cu-pd-notify",
      "service": "svc-intelligence",
      "kind": "manager",
      "label": "NotifyUserManager",
      "path": "src/Manager/NotifyUserManager.ts",
      "description": "Pushes each page result to the client via WebsocketSqsRepository (legacy genericMessage queue)"
    },
    {
      "id": "cu-pd-front-modal",
      "service": "skello-app-front",
      "kind": "component",
      "label": "PayslipsDispatchModal",
      "path": "apps/vue-app/src/users/shared/components/PayslipsDispatchModal/index.vue",
      "description": "Orchestrates the dispatch from the browser — creates the file (toSplit + toAnalyze, 1 h TTL), listens on the websocket, groups pages into payslip rows, cuts each row out via extract-pages, then on confirm saves the validation and PATCHes the matched documents"
    },
    {
      "id": "cu-pd-front-matching",
      "service": "skello-app-front",
      "kind": "service",
      "label": "matchEmployeesToPayslips",
      "path": "apps/vue-app/src/users/shared/utils/matching.service.js",
      "description": "Matches a page's extracted identity to the employee pool — identity number, then first and last name, then city and street, then compound name; a match needs exactly one employee, otherwise the payslip stays unmatched"
    },
    {
      "id": "cu-pd-docs-controller",
      "service": "svc-documents-v2",
      "kind": "controller",
      "label": "DocumentsApiController",
      "path": "src/Controller/DocumentsApiController.ts",
      "description": "createAction stamps organisationId/userId into metadata for analysed files; extractPagesAction (POST /documents/extract-pages); bulkPatchAction (PATCH /documents, manage-employee-documents permission checked first)"
    },
    {
      "id": "cu-pd-inprogress-mgr",
      "service": "svc-documents-v2",
      "kind": "manager",
      "label": "DocumentInProgressManager",
      "path": "src/Manager/DocumentInProgressManager.ts",
      "description": "batchCreate — in-progress row plus presigned upload URL; turns the action flags into toAnalyze/toSplit/analysisType metadata"
    },
    {
      "id": "cu-pd-s3-listener",
      "service": "svc-documents-v2",
      "kind": "job",
      "label": "S3FileListenerJobHandler",
      "path": "src/Handler/Job/S3FileListenerJobHandler.ts",
      "description": "S3 ObjectCreated promotes the in-progress row to a DOCUMENT; customTTL becomes deletedAt; runs for the upload, every split page and every extracted payslip"
    },
    {
      "id": "cu-pd-docs-mgr",
      "service": "svc-documents-v2",
      "kind": "manager",
      "label": "DocumentManager",
      "path": "src/Manager/DocumentManager.ts",
      "description": "Upsert of the DOCUMENT row; bulkPatch merges employeeId/folderPath/title/creatorId into each payslip and clears deletedAt"
    },
    {
      "id": "cu-pd-split-handler",
      "service": "svc-documents-v2",
      "kind": "job",
      "label": "SplitInPagesJobHandler",
      "path": "src/Handler/Job/SplitInPagesJobHandler.ts",
      "description": "Stream INSERT of a DOCUMENT with toSplit=true; splits the file into one document per page"
    },
    {
      "id": "cu-pd-splitter-mgr",
      "service": "svc-documents-v2",
      "kind": "manager",
      "label": "DocumentSplitterManager",
      "path": "src/Manager/DocumentSplitterManager.ts",
      "description": "generateAndUploadDocumentsByPage (one DOCUMENT per page with currentPage/totalPages/originalDocumentId, splitted=true, inherited TTL) and extractAndUploadPagesFromDocument (a payslip's pages cut into a new document)"
    },
    {
      "id": "cu-pd-notify-employee-handler",
      "service": "svc-documents-v2",
      "kind": "job",
      "label": "NotifyEmployeeHandler",
      "path": "src/Handler/Job/NotifyEmployeeHandler.ts",
      "description": "Stream consumer; for payslips only the MODIFY filter matches (folderPath /pay_slips, source SVC_INTELLIGENCE_EXTRACT_PAGES, deletedAt absent) and only when employeeId changed"
    },
    {
      "id": "cu-pd-employee-mgr",
      "service": "svc-documents-v2",
      "kind": "manager",
      "label": "EmployeeManager",
      "path": "src/Manager/EmployeeManager.ts",
      "description": "notifyOnNewDocument — the document has employeeId and creatorId and no deletedAt, the creator is not the employee, the employee exists in the local projection and has not opted out (receivesDocumentNotification, default true)"
    },
    {
      "id": "cu-pd-notify-employee-mgr",
      "service": "svc-documents-v2",
      "kind": "manager",
      "label": "NotifyEmployeeManager",
      "path": "src/Manager/NotifyEmployeeManager.ts",
      "description": "NEW_DOCUMENT email (skipped when the employee has no email) and Expo push linking to /v3/profile/documents, via the comms SDK createLowPriority"
    }
  ],
  "codeEdges": [
    {
      "from": "cu-pd-front-modal",
      "to": "svc-documents-v2",
      "label": "document.create + upload; POST /documents/extract-pages once every page arrived or the watchdog fired (300 s to first page, 60 s idle; rows over 50 pages skipped); PATCH /documents (matched rows)",
      "mode": "sync"
    },
    {
      "from": "svc-documents-v2",
      "to": "cu-pd-docs-controller",
      "label": "documents routes (create, extract-pages, bulk patch)",
      "mode": "sync"
    },
    {
      "from": "cu-pd-docs-controller",
      "to": "cu-pd-inprogress-mgr",
      "label": "batchCreate",
      "mode": "sync"
    },
    {
      "from": "svc-documents-v2",
      "to": "cu-pd-s3-listener",
      "label": "S3 ObjectCreated (upload, every split page, every extracted payslip)",
      "mode": "async-event"
    },
    {
      "from": "cu-pd-s3-listener",
      "to": "cu-pd-docs-mgr",
      "label": "promote in-progress to DOCUMENT (customTTL becomes deletedAt)",
      "mode": "sync"
    },
    {
      "from": "cu-pd-docs-mgr",
      "to": "dynamo-docs-v2-pd",
      "label": "DOCUMENT upsert + payslip bulkPatch",
      "mode": "sync",
      "crud": ["create", "update"]
    },
    {
      "from": "dynamo-docs-v2-pd",
      "to": "cu-pd-split-handler",
      "label": "own DynamoDB stream — INSERT DOCUMENT",
      "mode": "async-event",
      "condition": "metadata.toSplit = 'true'",
      "failure": {
        "queue": "SplitInPagesJob stream",
        "dlq": "SplitInPagesJobDlq",
        "retryPolicy": "maximumRetryAttempts 5",
        "onError": "A failed split leaves the file without pages, so nothing is analysed; the analysis times out in the browser"
      }
    },
    {
      "from": "cu-pd-split-handler",
      "to": "cu-pd-splitter-mgr",
      "label": "generateAndUploadDocumentsByPage",
      "mode": "sync"
    },
    {
      "from": "cu-pd-splitter-mgr",
      "to": "cu-pd-inprogress-mgr",
      "label": "batchCreate one document per page",
      "mode": "sync"
    },
    {
      "from": "dynamo-docs-v2-pd",
      "to": "cu-pd-analyze-listener",
      "label": "own DynamoDB stream — INSERT of each split page",
      "mode": "async-event",
      "condition": "metadata.splitted = 'true' AND toAnalyze = 'true'"
    },
    {
      "from": "cu-pd-analyze-listener",
      "to": "cu-pd-extract-mgr",
      "label": "DocumentExtractDataManager batchSend",
      "mode": "sync"
    },
    {
      "from": "cu-pd-extract-mgr",
      "to": "svc-intelligence",
      "label": "ExtractDataFromDocumentDto → extractDataFromDocument SQS",
      "mode": "async-job",
      "failure": {
        "queue": "extractDataFromDocumentSQS",
        "dlq": "extractDataFromDocumentDlq",
        "retryPolicy": "maxReceiveCount 1 (queue managed in svc-intelligence-tf)",
        "onError": "A failed extraction lands in the DLQ after a single attempt — the payslip stays undispatched until the message is redriven or the document re-uploaded"
      }
    },
    {
      "from": "cu-pd-handler",
      "to": "cu-pd-doc-manager",
      "label": "analysis request (SQS record)",
      "mode": "sync"
    },
    {
      "from": "cu-pd-doc-manager",
      "to": "dynamo-intelligence",
      "label": "analysis state",
      "mode": "sync",
      "crud": ["create", "update"]
    },
    {
      "from": "cu-pd-doc-manager",
      "to": "cu-pd-docs-repo",
      "label": "fetch source document",
      "mode": "sync"
    },
    {
      "from": "cu-pd-docs-repo",
      "to": "svc-documents-v2",
      "label": "document content",
      "mode": "sync"
    },
    {
      "from": "cu-pd-doc-manager",
      "to": "cu-pd-bedrock",
      "label": "LLM extraction (PDF → images → fields)",
      "mode": "sync"
    },
    {
      "from": "cu-pd-handler",
      "to": "dynamo-intelligence",
      "label": "one LLMResponse per page (error pages stored as '{}' ERROR)",
      "mode": "sync",
      "crud": ["create", "update"]
    },
    {
      "from": "dynamo-intelligence",
      "to": "cu-pd-notify-handler",
      "label": "own DynamoDB stream — INSERT LLMResponse (questionScope filter)",
      "mode": "async-event"
    },
    {
      "from": "cu-pd-notify-handler",
      "to": "cu-pd-notify",
      "label": "page result",
      "mode": "sync"
    },
    {
      "from": "cu-pd-notify",
      "to": "svc-websockets",
      "label": "websocket-genericMessage",
      "mode": "async-job"
    },
    {
      "from": "svc-websockets",
      "to": "cu-pd-front-modal",
      "label": "per-page result on the Generic websocket",
      "mode": "async-event"
    },
    {
      "from": "cu-pd-front-modal",
      "to": "skello-app",
      "label": "GET /v3/api/employees/payslips_managees (employee pool)",
      "mode": "sync",
      "crud": ["read"]
    },
    {
      "from": "cu-pd-front-modal",
      "to": "cu-pd-front-matching",
      "label": "matchEmployeesToPayslips per page",
      "mode": "sync",
      "condition": "exactly one employee matches"
    },
    {
      "from": "cu-pd-docs-controller",
      "to": "cu-pd-splitter-mgr",
      "label": "extractAndUploadPagesFromDocument",
      "mode": "sync"
    },
    {
      "from": "cu-pd-front-modal",
      "to": "svc-intelligence",
      "label": "POST /validationResponses (matched rows only)",
      "mode": "sync",
      "condition": "no e-signature; fire-and-forget"
    },
    {
      "from": "cu-pd-docs-controller",
      "to": "cu-pd-docs-mgr",
      "label": "bulkPatch (clears deletedAt)",
      "mode": "sync"
    },
    {
      "from": "dynamo-docs-v2-pd",
      "to": "cu-pd-notify-employee-handler",
      "label": "own DynamoDB stream — MODIFY of a payslip",
      "mode": "async-event",
      "condition": "folderPath /pay_slips, source SVC_INTELLIGENCE_EXTRACT_PAGES, deletedAt absent, employeeId changed",
      "failure": {
        "queue": "NotifyEmployeeJob stream",
        "dlq": "NotifyEmployeeJobDlq",
        "retryPolicy": "maximumRetryAttempts 5",
        "onError": "A dead-lettered record means the employee is not told; the payslip is already in their folder"
      }
    },
    {
      "from": "cu-pd-notify-employee-handler",
      "to": "cu-pd-employee-mgr",
      "label": "notifyOnNewDocument",
      "mode": "sync",
      "condition": "creator is not the employee, employee in the local projection, not opted out"
    },
    {
      "from": "cu-pd-employee-mgr",
      "to": "cu-pd-notify-employee-mgr",
      "label": "email + push DTOs",
      "mode": "sync"
    },
    {
      "from": "cu-pd-notify-employee-mgr",
      "to": "svc-communications-v2",
      "label": "createLowPriority email + push (NEW_DOCUMENT)",
      "mode": "async-job",
      "failure": {
        "queue": "bulkCreateNotificationLowPrioritySqs",
        "dlq": "bulkCreateNotificationLowPriorityDlq",
        "onError": "A dead-lettered notification batch means the employee is not told about the payslip; the handler rethrows so its own DLQ catches the record too"
      }
    }
  ],
  "infraNodes": [
    {
      "id": "dynamo-docs-v2-pd",
      "type": "dynamodb",
      "label": "SvcDocV2-{env}",
      "resources": ["ddb:svcDocumentsV2"],
      "description": "svc-documents-v2's table — holds the uploaded file, the per-page documents and the cut payslips; its stream drives splitting, analysis requests and employee notification"
    },
    {
      "id": "dynamo-intelligence",
      "type": "dynamodb",
      "label": "svcIntelligence-{env}",
      "resources": ["ddb:svcIntelligence"],
      "description": "Document analysis requests and extraction state"
    },
    {
      "id": "mongo-intelligence-pd",
      "type": "mongodb",
      "label": "svc-intelligence MongoDB",
      "resources": ["mongo:svc-intelligence"],
      "description": "The service's Mongo store (also shared with the AI assistant's conversation checkpoints)"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-intelligence",
      "to": "dynamo-intelligence",
      "label": "analysis state",
      "crud": ["create", "update"]
    },
    {
      "from": "svc-intelligence",
      "to": "mongo-intelligence-pd",
      "label": "extraction artifacts",
      "crud": ["create"]
    }
  ]
})

export default payslip_dispatch
