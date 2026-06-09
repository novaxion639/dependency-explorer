import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_hris: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-hris",
  "type": "typescript-microservice",
  "description": "HR Information System bridge — syncs employee and organisation data from external HRIS providers",
  "endpoints": [
    {
      "id": "api-get-hris-integrations",
      "path": "/integrations",
      "method": "GET",
      "description": "Get HRIS integrations",
      "useCase": "Used by calling services to get HRIS integrations",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcHris-{env}"
        },
        {
          "type": "s3",
          "name": "svc-hris.{env}"
        }
      ]
    },
    {
      "id": "api-connect-hris-integration",
      "path": "/integrations/connect",
      "method": "POST",
      "description": "Connect HRIS integration",
      "useCase": "Used by calling services to connect HRIS integration",
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
          "name": "svcHris-{env}"
        },
        {
          "type": "s3",
          "name": "svc-hris.{env}"
        }
      ]
    },
    {
      "id": "api-disconnect-hris-integration",
      "path": "/integrations/{integrationId}/disconnect",
      "method": "POST",
      "description": "Disconnect HRIS integration",
      "useCase": "Used by calling services to disconnect HRIS integration",
      "params": [
        {
          "name": "integrationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "integrationId identifier"
        },
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
          "name": "svcHris-{env}"
        },
        {
          "type": "s3",
          "name": "svc-hris.{env}"
        }
      ]
    },
    {
      "id": "api-sync-hris-integration",
      "path": "/integrations/{integrationId}/sync",
      "method": "POST",
      "description": "Sync HRIS integration",
      "useCase": "Used by calling services to sync HRIS integration",
      "params": [
        {
          "name": "integrationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "integrationId identifier"
        },
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
          "name": "svcHris-{env}"
        },
        {
          "type": "s3",
          "name": "svc-hris.{env}"
        }
      ]
    },
    {
      "id": "api-preview-hris-sync",
      "path": "/integrations/{integrationId}/sync/preview",
      "method": "GET",
      "description": "Preview HRIS sync",
      "useCase": "Used by calling services to preview HRIS sync",
      "params": [
        {
          "name": "integrationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "integrationId identifier"
        }
      ],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcHris-{env}"
        },
        {
          "type": "s3",
          "name": "svc-hris.{env}"
        }
      ]
    },
    {
      "id": "api-apply-hris-sync",
      "path": "/integrations/{integrationId}/sync/apply",
      "method": "POST",
      "description": "Apply HRIS sync",
      "useCase": "Used by calling services to apply HRIS sync",
      "params": [
        {
          "name": "integrationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "integrationId identifier"
        },
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
          "name": "svcHris-{env}"
        },
        {
          "type": "s3",
          "name": "svc-hris.{env}"
        }
      ]
    },
    {
      "id": "api-get-hris-fields",
      "path": "/integrations/{integrationId}/fields",
      "method": "GET",
      "description": "Get HRIS integration fields",
      "useCase": "Used by calling services to get HRIS integration fields",
      "params": [
        {
          "name": "integrationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "integrationId identifier"
        }
      ],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcHris-{env}"
        },
        {
          "type": "s3",
          "name": "svc-hris.{env}"
        }
      ]
    },
    {
      "id": "api-update-hris-fields",
      "path": "/integrations/{integrationId}/fields",
      "method": "PATCH",
      "description": "Update HRIS integration fields mapping",
      "useCase": "Used by calling services to update HRIS integration fields mapping",
      "params": [
        {
          "name": "integrationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "integrationId identifier"
        },
        {
          "name": "body",
          "in": "body",
          "type": "object",
          "required": true,
          "description": "Request payload"
        }
      ],
      "response": {
        "200": "Updated",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcHris-{env}"
        },
        {
          "type": "s3",
          "name": "svc-hris.{env}"
        }
      ]
    },
    {
      "id": "api-get-hris-employees",
      "path": "/integrations/{integrationId}/employees",
      "method": "GET",
      "description": "Get HRIS employees",
      "useCase": "Used by calling services to get HRIS employees",
      "params": [
        {
          "name": "integrationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "integrationId identifier"
        }
      ],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcHris-{env}"
        },
        {
          "type": "s3",
          "name": "svc-hris.{env}"
        }
      ]
    },
    {
      "id": "api-get-kombo-link",
      "path": "/kombo/link",
      "method": "GET",
      "description": "Get Kombo integration link",
      "useCase": "Used by calling services to get Kombo integration link",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcHris-{env}"
        },
        {
          "type": "s3",
          "name": "svc-hris.{env}"
        }
      ]
    },
    {
      "id": "api-kombo-webhook",
      "path": "/kombo/webhook",
      "method": "POST",
      "description": "Handle Kombo webhook",
      "useCase": "Used by calling services to handle Kombo webhook",
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
          "name": "svcHris-{env}"
        },
        {
          "type": "s3",
          "name": "svc-hris.{env}"
        }
      ]
    },
    {
      "id": "api-get-hris-shops",
      "path": "/shops",
      "method": "GET",
      "description": "Get HRIS shops",
      "useCase": "Used by calling services to get HRIS shops",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcHris-{env}"
        },
        {
          "type": "s3",
          "name": "svc-hris.{env}"
        }
      ]
    },
    {
      "id": "api-update-hris-shop",
      "path": "/shops/{shopId}",
      "method": "PATCH",
      "description": "Update HRIS shop",
      "useCase": "Used by calling services to update HRIS shop",
      "params": [
        {
          "name": "shopId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "shopId identifier"
        },
        {
          "name": "body",
          "in": "body",
          "type": "object",
          "required": true,
          "description": "Request payload"
        }
      ],
      "response": {
        "200": "Updated",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcHris-{env}"
        },
        {
          "type": "s3",
          "name": "svc-hris.{env}"
        }
      ]
    }
  ],
  "databases": [
    {
      "type": "dynamodb",
      "name": "svcHris-{env}",
      "description": "HRIS integration credentials and sync state"
    },
    {
      "type": "s3",
      "name": "svc-hris.{env}",
      "description": "Employee data exports and import files"
    },
    {
      "type": "sqs",
      "name": "svc-hris-sync-dlq",
      "description": "Failed HRIS sync retry queue"
    }
  ]
})

export default svc_hris
