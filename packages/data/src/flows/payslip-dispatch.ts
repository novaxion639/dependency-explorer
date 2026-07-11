import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Flow inventory follow-up (documents domain). Traced 2026-06-15 in
// svc-intelligence source: PAYSLIPS is the DEFAULT AnalysisType of the
// document-extraction pipeline (ExtractDataFromDocumentHandler; known limits
// documented in the repo's docs/payslip-limitations.md). The SvcIntelligence
// 'Payslip dispatch' FigJam board (8c9T22Sgu9rosbqwrXznCg) remains unswept —
// diff this flow against it when board access is available.
const payslip_dispatch: ServiceFlow = ServiceFlowSchema.parse({
  "id": "payslip-dispatch",
  "name": "Payslip Extraction & Dispatch",
  "description": "An employer's bulk payslip document is processed by svc-intelligence's AI extraction pipeline: an SQS analysis request (sender not yet traced — candidate: svc-documents-v2's ingestion) drives the extraction job, which fetches the document content from svc-documents-v2, converts PDF pages to images, and runs LLM extraction on Bedrock to identify per-employee payslips (analysisType defaults to PAYSLIPS; LLM field-accuracy limits are documented in the service's payslip-limitations doc). Progress and completion are pushed to the client over the LEGACY websockets genericMessage queue; per-employee document delivery and the 'document ready' employee notification ride the existing svc-documents-v2 → comms-v2 path.",
  "steps": [
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
      "description": "Separate SQS job delivering progress/completion pushes through NotifyUserManager"
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
      "from": "cu-pd-notify-handler",
      "to": "cu-pd-notify",
      "label": "progress + completion (own SQS trigger)",
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
