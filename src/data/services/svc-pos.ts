import { ConnectivityServiceSchema } from '../schemas'
import type { ConnectivityService } from '../schemas'

const svc_pos: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-pos",
  "type": "typescript-microservice",
  "description": "Point-of-sale integration — syncs revenue and transaction data from POS terminals for KPI forecasting",
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
      "id": "api-handle-chift-webhook",
      "path": "/chift/webhook",
      "method": "POST",
      "description": "Handle Chift webhook",
      "useCase": "Used by calling services to handle Chift webhook",
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
      "id": "api-activate-chift-integration",
      "path": "/chift/activate",
      "method": "POST",
      "description": "Activate Chift POS integration",
      "useCase": "Used by calling services to activate Chift POS integration",
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
      "id": "api-get-integration",
      "path": "/integrations/{integrationId}",
      "method": "GET",
      "description": "Get POS integration by ID",
      "useCase": "Used by calling services to get POS integration by ID",
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
          "name": "svcPos-{env}"
        }
      ]
    },
    {
      "id": "api-update-integration",
      "path": "/integrations/{integrationId}",
      "method": "PATCH",
      "description": "Update POS integration",
      "useCase": "Used by calling services to update POS integration",
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
          "name": "svcPos-{env}"
        }
      ]
    },
    {
      "id": "api-delete-integration",
      "path": "/integrations/{integrationId}",
      "method": "DELETE",
      "description": "Delete POS integration",
      "useCase": "Used by calling services to delete POS integration",
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
        "204": "Deleted",
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
      "id": "api-get-provider",
      "path": "/providers/{providerId}",
      "method": "GET",
      "description": "Get POS provider by ID",
      "useCase": "Used by calling services to get POS provider by ID",
      "params": [
        {
          "name": "providerId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "providerId identifier"
        }
      ],
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
      "id": "api-update-provider",
      "path": "/providers/{providerId}",
      "method": "PATCH",
      "description": "Update POS provider",
      "useCase": "Used by calling services to update POS provider",
      "params": [
        {
          "name": "providerId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "providerId identifier"
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
          "name": "svcPos-{env}"
        }
      ]
    },
    {
      "id": "api-delete-provider",
      "path": "/providers/{providerId}",
      "method": "DELETE",
      "description": "Delete POS provider",
      "useCase": "Used by calling services to delete POS provider",
      "params": [
        {
          "name": "providerId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "providerId identifier"
        }
      ],
      "response": {
        "204": "Deleted",
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
      "id": "api-get-shop-integrations",
      "path": "/shops/{shopId}/integrations",
      "method": "GET",
      "description": "Get POS integrations for a shop",
      "useCase": "Used by calling services to get POS integrations for a shop",
      "params": [
        {
          "name": "shopId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "shopId identifier"
        }
      ],
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
      "id": "api-activate-shop-integration",
      "path": "/shops/{shopId}/integrations/activate",
      "method": "POST",
      "description": "Activate POS integration for a shop",
      "useCase": "Used by calling services to activate POS integration for a shop",
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
      "id": "api-deactivate-shop-integration",
      "path": "/shops/{shopId}/integrations/deactivate",
      "method": "POST",
      "description": "Deactivate POS integration for a shop",
      "useCase": "Used by calling services to deactivate POS integration for a shop",
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
      "id": "api-get-shop-sales",
      "path": "/shops/{shopId}/sales",
      "method": "GET",
      "description": "Get POS sales data for a shop",
      "useCase": "Used by calling services to get POS sales data for a shop",
      "params": [
        {
          "name": "shopId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "shopId identifier"
        }
      ],
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
