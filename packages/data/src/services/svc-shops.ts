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
      "id": "api-public-swagger-index",
      "path": "/public",
      "method": "GET",
      "description": "Shows public swagger",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-public-swagger-docs",
      "path": "/public/docs.json",
      "method": "GET",
      "description": "Shows docs of public swagger",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-get-one-shop",
      "path": "/v1/shops/{id}",
      "method": "GET",
      "description": "Get shop by id",
      "useCase": "",
      "params": [
        {
          "name": "id",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-get-one-mission",
      "path": "/v1/missions/{id}",
      "method": "GET",
      "description": "Get one mission by ID",
      "useCase": "",
      "params": [
        {
          "name": "id",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-purge-missions",
      "path": "/v1/missions/purge",
      "method": "DELETE",
      "description": "Purge all missions for specified shops",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-get-all-missions-by-shop",
      "path": "/v1/shops/{shopId}/missions",
      "method": "GET",
      "description": "Get all missions by shopId",
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
      "id": "api-upload-missions",
      "path": "/v1/missions/upload",
      "method": "POST",
      "description": "Upload missions from a CSV file",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-get-mission-additional-infos",
      "path": "/v1/missions/{id}/additional_infos",
      "method": "GET",
      "description": "Get additional infos for a mission (hours, latest shift, wage validation)",
      "useCase": "",
      "params": [
        {
          "name": "id",
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
      "type": "mongodb",
      "name": "svc-shops",
      "description": "Shop configuration, missions and organisation settings"
    }
  ]
})

export default svc_shops
