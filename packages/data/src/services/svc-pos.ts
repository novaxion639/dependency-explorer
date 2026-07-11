import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_pos: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-pos",
  "type": "typescript-microservice",
  "description": "Point-of-sale integration — syncs revenue and transaction data from POS terminals for KPI forecasting. Providers connect two ways: through the Chift integration platform (webhooks + activation API) AND directly — L'Addition, Revo and Agora each have a dedicated client and a cron integrationEventDispatcher (verified 2026-07-12). Monolith data arrives via skelloapp-bus CDC plus a DMS full-load that writes SKELLOAPP_SHOP rows straight into the service's own DynamoDB table (FullLoadSkelloAppShopJob consumes the own-table stream filtered on that identifier). Aggregated revenue KPIs are written back to the monolith's WeeklyOptions (PATCH /private/pos/kpis).",
  "endpoints": [
    {
      "id": "api-get-chift-providers",
      "path": "/chift/providers",
      "method": "GET",
      "description": "Get Chift POS providers",
      "useCase": "Used by calling services to get Chift POS providers",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcPos-{env}"
        }
      ]
    },
    {
      "id": "api-get-integrations",
      "path": "/integrations",
      "method": "GET",
      "description": "Get POS integrations",
      "useCase": "Used by calling services to get POS integrations",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcPos-{env}"
        }
      ]
    },
    {
      "id": "api-create-integration",
      "path": "/integrations",
      "method": "POST",
      "description": "Create POS integration",
      "useCase": "Used by calling services to create POS integration",
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
          "name": "svcPos-{env}"
        }
      ]
    },
    {
      "id": "api-get-providers",
      "path": "/providers",
      "method": "GET",
      "description": "Get POS providers",
      "useCase": "Used by calling services to get POS providers",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcPos-{env}"
        }
      ]
    },
    {
      "id": "api-create-provider",
      "path": "/providers",
      "method": "POST",
      "description": "Create POS provider",
      "useCase": "Used by calling services to create POS provider",
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
          "name": "svcPos-{env}"
        }
      ]
    },
    {
      "id": "api-chift-webhooks",
      "path": "/chift/webhooks",
      "method": "POST",
      "description": "POST /chift/webhooks",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-chift-activate-provider",
      "path": "/chift/{organisationId}/activate",
      "method": "POST",
      "description": "Activate a POS integration with Chift provider",
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
      "id": "api-chift-delete",
      "path": "/chift/{organisationId}",
      "method": "DELETE",
      "description": "Delete Chift integration for an organisation",
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
      "id": "api-chift-delete-shop",
      "path": "/chift/{organisationId}/shops/{shopId}",
      "method": "DELETE",
      "description": "Delete Chift integration for a shop",
      "useCase": "",
      "params": [
        {
          "name": "organisationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        },
        {
          "name": "shopId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-chift-locations-get",
      "path": "/chift/{organisationId}/locations",
      "method": "GET",
      "description": "List Chift provider locations for an organisation",
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
      "id": "api-integration-update",
      "path": "/integrations",
      "method": "PUT",
      "description": "Updates an integration",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-integration-delete",
      "path": "/integrations",
      "method": "DELETE",
      "description": "Deletes integration(s) based on query params",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-integration-run",
      "path": "/integrations/{shopId}/run",
      "method": "POST",
      "description": "Runs an integration for a shopId",
      "useCase": "",
      "params": [
        {
          "name": "shopId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-provider-requirements-find",
      "path": "/providers/{providerType}/requirements",
      "method": "GET",
      "description": "Provides the requirements to integrate with a POS Provider",
      "useCase": "",
      "params": [
        {
          "name": "providerType",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-pos-shop-find",
      "path": "/providers/{organisationConfigId}/shops",
      "method": "GET",
      "description": "Get shops for a given organisation config",
      "useCase": "",
      "params": [
        {
          "name": "organisationConfigId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-provider-update",
      "path": "/providers",
      "method": "PATCH",
      "description": "Partial update implemented provider in organisation configuration",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-provider-delete",
      "path": "/providers",
      "method": "DELETE",
      "description": "Delete implemented provider in organisation configuration",
      "useCase": "",
      "params": [],
      "response": {}
    }
  ],
  "databases": [
    {
      "type": "dynamodb",
      "name": "svcPos-{env}",
      "description": "POS integration credentials and webhook state"
    }
  ]
})

export default svc_pos
