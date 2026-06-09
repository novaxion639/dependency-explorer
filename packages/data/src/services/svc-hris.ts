import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_hris: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-hris",
  "type": "typescript-microservice",
  "description": "HR Information System bridge — syncs employee and organisation data from external HRIS providers",
  "endpoints": [
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
      "id": "api-integration-status",
      "path": "/v1/integrations/{organisationId}/status",
      "method": "GET",
      "description": "Retrieve the current status for organisation",
      "useCase": "",
      "params": [
        {
          "name": "organisationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-integration-disconnect",
      "path": "/v1/integrations/{integrationId}",
      "method": "DELETE",
      "description": "Remove a specific integration with HR tool",
      "useCase": "",
      "params": [
        {
          "name": "integrationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-integration-disconnect-by-organisation",
      "path": "/v1/integrations/organisation/{organisationId}",
      "method": "DELETE",
      "description": "Remove all integrations for an organisation",
      "useCase": "",
      "params": [
        {
          "name": "organisationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-integration-preview",
      "path": "/v1/integrations/{integrationId}/preview",
      "method": "GET",
      "description": "Get the sync changes for user review, creating and updating employees in svc-employees service",
      "useCase": "",
      "params": [
        {
          "name": "integrationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-integration-apply",
      "path": "/v1/integrations/{integrationId}/apply",
      "method": "POST",
      "description": "Apply the sync changes after user review, creating and updating employees in svc-employees service",
      "useCase": "",
      "params": [
        {
          "name": "integrationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-integration-update-send-email-invitation",
      "path": "/v1/integrations/organisation/{organisationId}/send-email-invitations",
      "method": "PATCH",
      "description": "Update the sendEmployeeEmailInvitation setting for integrations within an organisation",
      "useCase": "",
      "params": [
        {
          "name": "organisationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-integration-get-work-locations",
      "path": "/v1/integrations/{integrationId}/work-locations",
      "method": "GET",
      "description": "Retrieve work locations from Kombo for a specific integration",
      "useCase": "",
      "params": [
        {
          "name": "integrationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "integration-update-shop-mapping-api",
      "path": "/v1/integrations/{integrationId}/shops-mapping",
      "method": "PATCH",
      "description": "Updates shop to work location mapping for an integration",
      "useCase": "",
      "params": [
        {
          "name": "integrationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-integration-get-tools",
      "path": "/v1/integrations/tools",
      "method": "GET",
      "description": "Retrieve available HRIS integration tools from Kombo",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-integration-get-general-info",
      "path": "/v1/integrations/{organisationId}/general-info",
      "method": "GET",
      "description": "Retrieve general information about HRIS integrations from Kombo",
      "useCase": "",
      "params": [
        {
          "name": "organisationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-webhook-kombo",
      "path": "/webhook/kombo",
      "method": "POST",
      "description": "POST /webhook/kombo",
      "useCase": "",
      "params": [],
      "response": {}
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
