import { ConnectivityServiceSchema } from '../schemas'
import type { ConnectivityService } from '../schemas'

const svc_labour_laws: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-labour-laws",
  "type": "typescript-microservice",
  "description": "Labour law rules engine — validates schedules against country-specific legal constraints",
  "endpoints": [
    {
      "id": "api-upsert-shop",
      "path": "/shops",
      "method": "POST",
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
      "id": "api-batch-upsert-shops",
      "path": "/shops/batch",
      "method": "POST",
      "description": "Batch upsert shops labour law data",
      "useCase": "Used by calling services to batch upsert shops labour law data",
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
      "id": "api-get-labour-law-overrides",
      "path": "/overrides",
      "method": "GET",
      "description": "Get labour law overrides",
      "useCase": "Used by calling services to get labour law overrides",
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
      "id": "api-create-labour-law-override",
      "path": "/overrides",
      "method": "POST",
      "description": "Create labour law override",
      "useCase": "Used by calling services to create labour law override",
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
      "id": "api-update-labour-law-override",
      "path": "/overrides/{overrideId}",
      "method": "PATCH",
      "description": "Update labour law override",
      "useCase": "Used by calling services to update labour law override",
      "params": [
        {
          "name": "overrideId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "overrideId identifier"
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
          "name": "svcLabourLaws-{env}"
        }
      ]
    },
    {
      "id": "api-delete-labour-law-override",
      "path": "/overrides/{overrideId}",
      "method": "DELETE",
      "description": "Delete labour law override",
      "useCase": "Used by calling services to delete labour law override",
      "params": [
        {
          "name": "overrideId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "overrideId identifier"
        }
      ],
      "response": {
        "204": "Deleted",
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
      "id": "api-create-labour-law",
      "path": "/labour-laws",
      "method": "POST",
      "description": "Create labour law",
      "useCase": "Used by calling services to create labour law",
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
      "id": "api-update-labour-law",
      "path": "/labour-laws/{labourLawId}",
      "method": "PATCH",
      "description": "Update labour law",
      "useCase": "Used by calling services to update labour law",
      "params": [
        {
          "name": "labourLawId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "labourLawId identifier"
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
          "name": "svcLabourLaws-{env}"
        }
      ]
    },
    {
      "id": "api-delete-labour-law",
      "path": "/labour-laws/{labourLawId}",
      "method": "DELETE",
      "description": "Delete labour law",
      "useCase": "Used by calling services to delete labour law",
      "params": [
        {
          "name": "labourLawId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "labourLawId identifier"
        }
      ],
      "response": {
        "204": "Deleted",
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
