import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_shops: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-shops",
  "type": "typescript-microservice",
  "description": "Location and team management — stores, teams, opening hours and capacity rules",
  "endpoints": [
    {
      "id": "api-get-organisations-config",
      "path": "/organisations/{organisationId}/config",
      "method": "GET",
      "description": "Get organisation configuration",
      "useCase": "Used by calling services to get organisation configuration",
      "params": [
        {
          "name": "organisationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "organisationId identifier"
        }
      ],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "mongodb",
          "name": "svc-shops"
        }
      ]
    },
    {
      "id": "api-upsert-organisation-config",
      "path": "/organisations/{organisationId}/config",
      "method": "POST",
      "description": "Upsert organisation configuration",
      "useCase": "Used by calling services to upsert organisation configuration",
      "params": [
        {
          "name": "organisationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "organisationId identifier"
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
          "type": "mongodb",
          "name": "svc-shops"
        }
      ]
    },
    {
      "id": "api-get-shops",
      "path": "/shops",
      "method": "GET",
      "description": "Get shops",
      "useCase": "Used by calling services to get shops",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "mongodb",
          "name": "svc-shops"
        }
      ]
    },
    {
      "id": "api-create-shop",
      "path": "/shops",
      "method": "POST",
      "description": "Create shop",
      "useCase": "Used by calling services to create shop",
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
          "type": "mongodb",
          "name": "svc-shops"
        }
      ]
    },
    {
      "id": "api-update-shop",
      "path": "/shops/{shopId}",
      "method": "PATCH",
      "description": "Update shop",
      "useCase": "Used by calling services to update shop",
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
          "type": "mongodb",
          "name": "svc-shops"
        }
      ]
    },
    {
      "id": "api-delete-shop",
      "path": "/shops/{shopId}",
      "method": "DELETE",
      "description": "Delete shop",
      "useCase": "Used by calling services to delete shop",
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
        "204": "Deleted",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "mongodb",
          "name": "svc-shops"
        }
      ]
    },
    {
      "id": "api-get-missions",
      "path": "/missions",
      "method": "GET",
      "description": "Get missions",
      "useCase": "Used by calling services to get missions",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "mongodb",
          "name": "svc-shops"
        }
      ]
    },
    {
      "id": "api-create-mission",
      "path": "/missions",
      "method": "POST",
      "description": "Create mission",
      "useCase": "Used by calling services to create mission",
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
          "type": "mongodb",
          "name": "svc-shops"
        }
      ]
    },
    {
      "id": "api-update-mission",
      "path": "/missions/{missionId}",
      "method": "PATCH",
      "description": "Update mission",
      "useCase": "Used by calling services to update mission",
      "params": [
        {
          "name": "missionId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "missionId identifier"
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
          "type": "mongodb",
          "name": "svc-shops"
        }
      ]
    },
    {
      "id": "api-delete-mission",
      "path": "/missions/{missionId}",
      "method": "DELETE",
      "description": "Delete mission",
      "useCase": "Used by calling services to delete mission",
      "params": [
        {
          "name": "missionId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "missionId identifier"
        }
      ],
      "response": {
        "204": "Deleted",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "mongodb",
          "name": "svc-shops"
        }
      ]
    }
  ],
  "databases": [
    {
      "type": "mongodb",
      "name": "svc-shops",
      "description": "Shop configuration, missions and organisation settings"
    }
  ]
})

export default svc_shops
