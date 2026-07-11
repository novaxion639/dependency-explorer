import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_labour_laws: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-labour-laws",
  "type": "typescript-microservice",
  "description": "Labour law rules engine — validates schedules against country-specific legal constraints",
  "endpoints": [
    {
      "id": "api-upsert-shop",
      "path": "/shop",
      "method": "PUT",
      "description": "Upsert shop labour law data",
      "useCase": "Used by calling services to upsert shop labour law data",
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
          "name": "svcLabourLaws-{env}"
        }
      ]
    },
    {
      "id": "api-get-labour-laws",
      "path": "/labour-laws",
      "method": "GET",
      "description": "Get labour laws",
      "useCase": "Used by calling services to get labour laws",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcLabourLaws-{env}"
        }
      ]
    },
    {
      "id": "api-get-country-default-settings",
      "path": "/country-default-settings",
      "method": "GET",
      "description": "Get country default settings",
      "useCase": "Used by calling services to get country default settings",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcLabourLaws-{env}"
        }
      ]
    },
    {
      "id": "api-batch-upsert-shop",
      "path": "/shops/batch",
      "method": "PUT",
      "description": "PUT /shops/batch",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-update-shop-overrides",
      "path": "/overrides",
      "method": "PATCH",
      "description": "PATCH /overrides",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-available-labour-law-upsert",
      "path": "/labour_law",
      "method": "PUT",
      "description": "PUT /labour_law",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-available-labour-law-show",
      "path": "/labour_law",
      "method": "GET",
      "description": "GET /labour_law",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-available-labour-law-delete",
      "path": "/labour_law",
      "method": "DELETE",
      "description": "DELETE /labour_law",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-enabled-labour-laws-index",
      "path": "/enabled_labour_laws",
      "method": "GET",
      "description": "GET /enabled_labour_laws",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-country-default-settings-create",
      "path": "/country_default_settings",
      "method": "POST",
      "description": "Create countries default settings",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-country-default-settings-update",
      "path": "/country_default_settings/{countryCode}",
      "method": "PATCH",
      "description": "Update countries default settings",
      "useCase": "",
      "params": [
        {
          "name": "countryCode",
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
      "name": "svcLabourLaws-{env}",
      "description": "Labour law rule sets and shop compliance configs"
    }
  ]
})

export default svc_labour_laws
