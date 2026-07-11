import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

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
    },
    {
      "id": "api-create-documents",
      "path": "/documents",
      "method": "POST",
      "description": "Create document(s) and return presigned upload url(s)",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-index-documents",
      "path": "/documents",
      "method": "GET",
      "description": "find and return document(s)",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-purge-shifts-documents-for-shop",
      "path": "/documents/shifts/purge",
      "method": "DELETE",
      "description": "Purge all shifts documents (not employee documents) associated with the specified shops",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-shifts-documents",
      "path": "/documents/shifts",
      "method": "GET",
      "description": "find and return document(s) from shift(s)",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-url-document",
      "path": "/documents/{documentId}/url",
      "method": "GET",
      "description": "get url document from documentId",
      "useCase": "",
      "params": [
        {
          "name": "documentId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-show-document",
      "path": "/documents/{documentId}",
      "method": "GET",
      "description": "get full document from documentId",
      "useCase": "",
      "params": [
        {
          "name": "documentId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-delete-document",
      "path": "/documents/{documentId}",
      "method": "DELETE",
      "description": "Soft delete a document by updating its deletedAt",
      "useCase": "",
      "params": [
        {
          "name": "documentId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-update-document",
      "path": "/documents/{documentId}",
      "method": "PUT",
      "description": "update document name",
      "useCase": "",
      "params": [
        {
          "name": "documentId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-bulk-patch-document",
      "path": "/documents",
      "method": "PATCH",
      "description": "Patch multliple documents",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-print-document",
      "path": "/documents/print",
      "method": "POST",
      "description": "print document name",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-generate-document",
      "path": "/documents/generate",
      "method": "POST",
      "description": "generate documents",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-mail-document-to-employee",
      "path": "/documents/{documentId}/email",
      "method": "POST",
      "description": "Send document by email to the employee associated with the document",
      "useCase": "",
      "params": [
        {
          "name": "documentId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-extract-pages-from-document",
      "path": "/documents/extract-pages",
      "method": "POST",
      "description": "extract and upload page from documents",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-expiring-documents",
      "path": "/documents/expiring",
      "method": "GET",
      "description": "get expiring documents",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-index-folders",
      "path": "/folders",
      "method": "GET",
      "description": "find and return folder(s)",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-update-folder",
      "path": "/folders/{folderId}",
      "method": "PATCH",
      "description": "update folder attributes",
      "useCase": "",
      "params": [
        {
          "name": "folderId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-create-folder",
      "path": "/folders",
      "method": "POST",
      "description": "create a folder",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-bulk-delete-documents",
      "path": "/documents",
      "method": "DELETE",
      "description": "Soft delete multiple documents",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-delete-folder",
      "path": "/folders/{folderId}",
      "method": "DELETE",
      "description": "delete a folder",
      "useCase": "",
      "params": [
        {
          "name": "folderId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-create-avatar",
      "path": "/avatars",
      "method": "POST",
      "description": "Create avatar and return presigned upload url",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-delete-avatar",
      "path": "/avatars/{avatarId}",
      "method": "DELETE",
      "description": "Delete avatar",
      "useCase": "",
      "params": [
        {
          "name": "avatarId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-index-avatars",
      "path": "/avatars",
      "method": "GET",
      "description": "find and return avatar(s)",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-show-document-by-v1-id",
      "path": "/documents/V1/{documentId}",
      "method": "GET",
      "description": "get document from V1 documentId",
      "useCase": "",
      "params": [
        {
          "name": "documentId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "reactivate-signature-request-api",
      "path": "/signatures/reactivate",
      "method": "POST",
      "description": "Reactivate an expired signature request",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-create-template",
      "path": "/templates",
      "method": "POST",
      "description": "Create a new template (empty or duplicate)",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-delete-template",
      "path": "/templates/{templateId}",
      "method": "DELETE",
      "description": "Delete template",
      "useCase": "",
      "params": [
        {
          "name": "templateId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-get-template",
      "path": "/templates/{templateId}",
      "method": "GET",
      "description": "Get a template by id, optionally with a presigned content download URL",
      "useCase": "",
      "params": [
        {
          "name": "templateId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-list-template",
      "path": "/templates",
      "method": "GET",
      "description": "List the organisation templates",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-patch-template",
      "path": "/templates/{templateId}",
      "method": "PATCH",
      "description": "Partially update a template (title, variableList, disabled)",
      "useCase": "",
      "params": [
        {
          "name": "templateId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-put-template-lock",
      "path": "/templates/{templateId}/lock",
      "method": "PUT",
      "description": "Acquire or renew the editor lock on a template (acquire + save modes)",
      "useCase": "",
      "params": [
        {
          "name": "templateId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
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
      "type": "s3",
      "name": "skello-app.temporary-assets",
      "description": "SHARED monolith-named bucket: ApiPrintDocument stages printed documents here for presigned download (awsBucketTemporaryBucketName, serverless.ts). Same bucket the monolith's report exports use and svc-reports listens on. Surfaced by the 'SvcDocuments V2 (short)' board, code-verified 2026-07-12."
    },
    {
      "type": "sqs",
      "name": "svc-documents-v2-dlq",
      "description": "Failed document generation retry queue"
    }
  ]
})

export default svc_documents_v2
