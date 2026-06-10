import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

const document_generation_esignature: ServiceFlow = ServiceFlowSchema.parse({
  "id": "document-generation-esignature",
  "name": "Document Generation & E-Signature",
  "description": "A manager requests a document. The monolith generates a PDF via svc-documents-v2, starts an e-signature flow, then the frontend polls for the result.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST /v3/documents — request document"
    },
    {
      "from": "skello-app",
      "to": "svc-documents-v2",
      "action": "POST /documents/generate — generate PDF"
    },
    {
      "from": "skello-app",
      "to": "svc-documents-esignature",
      "action": "Start signature flow — Microservices::EsignatureService (generic HTTParty client; exact endpoint not yet verified)"
    },
    {
      "from": "skello-app-front",
      "to": "svc-documents-v2",
      "action": "GET /documents/:id — poll signature status"
    }
  ],
  "infraNodes": [
    {
      "id": "s3-docs",
      "type": "s3",
      "label": "documents-pdf.{env}",
      "description": "PDF storage bucket"
    },
    {
      "id": "lambda-sign",
      "type": "lambda",
      "label": "esignature-trigger",
      "description": "Invokes DocuSign API"
    },
    {
      "id": "pg-docs",
      "type": "postgresql",
      "label": "documents-db",
      "description": "Document metadata store"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-documents-v2",
      "to": "s3-docs",
      "label": "store PDF"
    },
    {
      "from": "svc-documents-v2",
      "to": "pg-docs",
      "label": "write metadata",
      "crud": ["create"]
    },
    {
      "from": "svc-documents-esignature",
      "to": "lambda-sign",
      "label": "invoke"
    }
  ]
})

export default document_generation_esignature
