import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Flow inventory follow-up (documents domain). Traced 2026-06-15 in
// svc-intelligence source; diffed against the 'Payslip dispatch' FigJam board
// (8c9T22Sgu9rosbqwrXznCg) on 2026-07-12, which resolved the sender AND
// corrected the notify trigger: the analysis request comes from
// svc-documents-v2's AnalyzeDocumentListenerJob (own-Dynamo-stream consumer
// batch-sending ExtractDataFromDocumentDto to the intelligence queue), and
// NotifyUser is triggered by svc-intelligence's own DynamoDB stream
// (INSERT of LLMResponse entities, questionScope filter incl. PAYSLIPS) —
// not by its own SQS queue as previously written.
const payslip_dispatch: ServiceFlow = ServiceFlowSchema.parse({
  "id": "payslip-dispatch",
  "name": "Payslip Extraction & Dispatch",
  "description": "An employer's bulk payslip document is processed by svc-intelligence's AI extraction pipeline. The request originates in svc-documents-v2: the document write hits its own DynamoDB stream, AnalyzeDocumentListenerJob batch-sends ExtractDataFromDocumentDto messages to svc-intelligence's queue. The extraction job fetches the document content back from svc-documents-v2, converts PDF pages to images, and runs LLM extraction on Bedrock to identify per-employee payslips (analysisType defaults to PAYSLIPS; field-accuracy limits documented in the service's payslip-limitations doc). When the LLMResponse lands in the intelligence DynamoDB table, its stream triggers NotifyUser, which pushes progress/completion to the client over the LEGACY websockets genericMessage queue; per-employee document delivery and the 'document ready' employee notification ride the existing svc-documents-v2 → comms-v2 path.",
  "steps": [
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
      "action": "Extraction progress/completion push (websocket-genericMessage — legacy websockets)"
    },
    {
      "from": "svc-documents-v2",
      "to": "svc-communications-v2",
      "action": "Employee 'document ready' notification (existing verified edge)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-pd-analyze-listener",
      "service": "svc-documents-v2",
      "kind": "job",
      "label": "AnalyzeDocumentListenerJobHandler",
      "path": "src/Handler/Job/AnalyzeDocumentListenerJobHandler.ts",
      "description": "Consumes svc-documents-v2's own DynamoDB stream and builds the analysis requests — the resolved sender of the extraction pipeline"
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
      "description": "SQS-triggered extraction job — analysisType defaults to AnalysisType.PAYSLIPS, questionScope PAYSLIPS; the analysis-request sender is not yet traced"
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
      "description": "Triggered by the intelligence table's own DynamoDB stream (INSERT of LLMResponse entities, questionScope filter incl. PAYSLIPS) — delivers progress/completion through NotifyUserManager (corrected 2026-07-12 via the Payslip dispatch board + serverless config)"
    },
    {
      "id": "cu-pd-bedrock",
      "service": "svc-intelligence",
      "kind": "manager",
      "label": "BedrockManager",
      "path": "src/Manager/BedrockManager.ts",
      "description": "LLM extraction on AWS Bedrock (with ConvertPdfToImageManager preparing page images and GetPromptManager/LLMResponseManager around the call)"
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
      "description": "Pushes progress/completion to the client via WebsocketSqsRepository (legacy genericMessage queue)"
    }
  ],
  "codeEdges": [
    {
      "from": "dynamo-docs-v2-pd",
      "to": "cu-pd-analyze-listener",
      "label": "own DynamoDB stream (document writes)",
      "mode": "async-event"
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
      "mode": "async-job"
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
      "from": "dynamo-intelligence",
      "to": "cu-pd-notify-handler",
      "label": "own DynamoDB stream — INSERT LLMResponse (questionScope filter)",
      "mode": "async-event"
    },
    {
      "from": "cu-pd-notify-handler",
      "to": "cu-pd-notify",
      "label": "progress + completion",
      "mode": "sync"
    },
    {
      "from": "cu-pd-notify",
      "to": "svc-websockets",
      "label": "websocket-genericMessage",
      "mode": "async-job"
    }
  ],
  "infraNodes": [
    {
      "id": "dynamo-docs-v2-pd",
      "type": "dynamodb",
      "label": "SvcDocV2-{env}",
      "description": "svc-documents-v2's table — its stream is the analysis-request trigger"
    },
    {
      "id": "dynamo-intelligence",
      "type": "dynamodb",
      "label": "svcIntelligence-{env}",
      "description": "Document analysis requests and extraction state"
    },
    {
      "id": "mongo-intelligence-pd",
      "type": "mongodb",
      "label": "svc-intelligence MongoDB",
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
