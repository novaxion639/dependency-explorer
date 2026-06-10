import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_documents_esignature: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-documents-esignature",
  "type": "typescript-microservice",
  "description": "Electronic signature workflows — integrates with e-signature providers (Yousign). ⚠ Decommission watch (2026-06-10): repo unpushed since 2026-01-06, the SDK is reduced to a single status-polling method, the signature surface has been absorbed by svc-documents-v2 (/signatures/* — reminders, cancel, fetch, signed URLs), and skello-app's esignatures jobs orchestrate Yousign directly. Remaining live callers: two skello-app v3 controllers (request_esignatures, users/documents), the frontend e-signature follow-up panel, and svc-intelligence status polling. Hostname/SDK use the older 'svc-esignature' name; the repo is svc-documents-esignature.",
  "tags": ["decommission-watch"],
  "endpoints": [
    {
      "id": "api-attendance-sheet-signature-reminder",
      "path": "/attendance-sheet-signature-reminder",
      "method": "POST",
      "description": "Send attendance sheet signature reminder",
      "useCase": "Used by calling services to send attendance sheet signature reminder",
      "params": [
        {
          "name": "body",
          "in": "body",
          "type": "object",
          "required": true,
          "description": "Request payload"
        }
      ],
      "response": {
        "201": "Created",
        "400": "Validation error"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcDocumentsEsignature-{env}"
        },
        {
          "type": "s3",
          "name": "svc-esignature.{env}"
        }
      ]
    },
    {
      "id": "api-document-signable",
      "path": "/document-signable",
      "method": "GET",
      "description": "Check if document is signable",
      "useCase": "Used by calling services to check if document is signable",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcDocumentsEsignature-{env}"
        },
        {
          "type": "s3",
          "name": "svc-esignature.{env}"
        }
      ]
    },
    {
      "id": "api-document-signature-reminder",
      "path": "/document-signature-reminder",
      "method": "POST",
      "description": "Send document signature reminder",
      "useCase": "Used by calling services to send document signature reminder",
      "params": [
        {
          "name": "body",
          "in": "body",
          "type": "object",
          "required": true,
          "description": "Request payload"
        }
      ],
      "response": {
        "201": "Created",
        "400": "Validation error"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcDocumentsEsignature-{env}"
        },
        {
          "type": "s3",
          "name": "svc-esignature.{env}"
        }
      ]
    },
    {
      "id": "api-documents-status",
      "path": "/documents-status",
      "method": "POST",
      "description": "Get documents signature status",
      "useCase": "Used by calling services to get documents signature status",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcDocumentsEsignature-{env}"
        },
        {
          "type": "s3",
          "name": "svc-esignature.{env}"
        }
      ]
    }
  ],
  "databases": [
    {
      "type": "dynamodb",
      "name": "svcDocumentsEsignature-{env}",
      "description": "E-signature requests and signatory state"
    },
    {
      "type": "s3",
      "name": "svc-esignature.{env}",
      "description": "Signed document storage"
    },
    {
      "type": "sqs",
      "name": "svc-esignature-dlq",
      "description": "Failed signature event retry queue"
    }
  ]
})

export default svc_documents_esignature
