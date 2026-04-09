import { ConnectivityServiceSchema } from '../schemas'
import type { ConnectivityService } from '../schemas'

const svc_documents_v2: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-documents-v2",
  "type": "typescript-microservice",
  "description": "Document lifecycle management — creation, storage, versioning and access control",
  "endpoints": [
    {
      "id": "api-bulk-send-signature-reminders",
      "path": "/signatures/reminders",
      "method": "POST",
      "description": "Send signature reminders in bulk for documents",
      "useCase": "Used by calling services to send signature reminders in bulk for documents",
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
          "name": "svcDocumentsV2-{env}"
        },
        {
          "type": "s3",
          "name": "svc-documents-v2.{env}"
        }
      ]
    },
    {
      "id": "api-bulk-send-reminders-from-filters",
      "path": "/signatures/reminders/from-filters",
      "method": "POST",
      "description": "Send signature reminders in bulk based on filters",
      "useCase": "Used by calling services to send signature reminders in bulk based on filters",
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
          "name": "svcDocumentsV2-{env}"
        },
        {
          "type": "s3",
          "name": "svc-documents-v2.{env}"
        }
      ]
    },
    {
      "id": "cancel-signature-request-api",
      "path": "/signatures/cancel",
      "method": "POST",
      "description": "Cancel signature request",
      "useCase": "Used by calling services to cancel signature request",
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
          "name": "svcDocumentsV2-{env}"
        },
        {
          "type": "s3",
          "name": "svc-documents-v2.{env}"
        }
      ]
    },
    {
      "id": "api-fetch-many-signatures",
      "path": "/signatures/fetch",
      "method": "POST",
      "description": "Retrieve multiple signatures based on provided criteria",
      "useCase": "Used by calling services to retrieve multiple signatures based on provided criteria",
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
          "name": "svcDocumentsV2-{env}"
        },
        {
          "type": "s3",
          "name": "svc-documents-v2.{env}"
        }
      ]
    },
    {
      "id": "api-fetch-employee-signatures-by-document-ids",
      "path": "/signatures/fetch-by-employee-documents",
      "method": "POST",
      "description": "Retrieve employee signatures associated with specific document IDs",
      "useCase": "Used by calling services to retrieve employee signatures associated with specific document IDs",
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
          "name": "svcDocumentsV2-{env}"
        },
        {
          "type": "s3",
          "name": "svc-documents-v2.{env}"
        }
      ]
    },
    {
      "id": "api-get-signature-document-url",
      "path": "/signatures/{shopId}/{documentId}/url",
      "method": "GET",
      "description": "Get signature document URL",
      "useCase": "Used by calling services to get signature document URL",
      "params": [
        {
          "name": "shopId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "shopId identifier"
        },
        {
          "name": "documentId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "documentId identifier"
        }
      ],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcDocumentsV2-{env}"
        },
        {
          "type": "s3",
          "name": "svc-documents-v2.{env}"
        }
      ]
    },
    {
      "id": "api-is-signable-document",
      "path": "/documents/signable",
      "method": "GET",
      "description": "Check if the document is signable or not",
      "useCase": "Used by calling services to check if the document is signable or not",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcDocumentsV2-{env}"
        },
        {
          "type": "s3",
          "name": "svc-documents-v2.{env}"
        }
      ]
    },
    {
      "id": "api-send-week-signature-documents-email",
      "path": "/signatures/week-documents-email",
      "method": "POST",
      "description": "Download week signature documents as ZIP and send via email",
      "useCase": "Used by calling services to download week signature documents as ZIP and send via email",
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
          "name": "svcDocumentsV2-{env}"
        },
        {
          "type": "s3",
          "name": "svc-documents-v2.{env}"
        }
      ]
    },
    {
      "id": "api-bulk-process-yousign-webhooks",
      "path": "/yousign/webhooks/bulk",
      "method": "POST",
      "description": "Push a batch of Yousign webhook payloads to the processing SQS queue",
      "useCase": "Used by calling services to push a batch of Yousign webhook payloads to the processing SQS queue",
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
          "name": "svcDocumentsV2-{env}"
        },
        {
          "type": "s3",
          "name": "svc-documents-v2.{env}"
        }
      ]
    }
  ],
  "databases": [
    {
      "type": "dynamodb",
      "name": "svcDocumentsV2-{env}",
      "description": "Document metadata, signatures and generation jobs"
    },
    {
      "type": "s3",
      "name": "svc-documents-v2.{env}",
      "description": "Generated PDFs, XLSX and templates"
    },
    {
      "type": "sqs",
      "name": "svc-documents-v2-dlq",
      "description": "Failed document generation retry queue"
    }
  ]
})

export default svc_documents_v2
