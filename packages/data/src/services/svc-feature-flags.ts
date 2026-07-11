import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_feature_flags: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-feature-flags",
  "type": "typescript-microservice",
  "description": "Feature flag management — controls feature rollout per account, percentage or user group",
  "endpoints": [
    {
      "id": "api-feature-flag-read",
      "path": "/feature-flag/{name}",
      "method": "GET",
      "description": "GET /feature-flag/{name}",
      "useCase": "",
      "params": [
        {
          "name": "name",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-feature-flag-upsert",
      "path": "/feature-flag/{name}",
      "method": "PUT",
      "description": "PUT /feature-flag/{name}",
      "useCase": "",
      "params": [
        {
          "name": "name",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-feature-flag-delete",
      "path": "/feature-flag/{name}",
      "method": "DELETE",
      "description": "DELETE /feature-flag/{name}",
      "useCase": "",
      "params": [
        {
          "name": "name",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-feature-flag-dev-read",
      "path": "/feature-flag-dev/{name}",
      "method": "GET",
      "description": "GET /feature-flag-dev/{name}",
      "useCase": "",
      "params": [
        {
          "name": "name",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-feature-flag-dev-upsert",
      "path": "/feature-flag-dev/{name}",
      "method": "PUT",
      "description": "PUT /feature-flag-dev/{name}",
      "useCase": "",
      "params": [
        {
          "name": "name",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-feature-flag-dev-delete",
      "path": "/feature-flag-dev/{name}",
      "method": "DELETE",
      "description": "DELETE /feature-flag-dev/{name}",
      "useCase": "",
      "params": [
        {
          "name": "name",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-features-list",
      "path": "/features",
      "method": "GET",
      "description": "GET /features",
      "useCase": "",
      "params": [],
      "response": {}
    }
  ],
  "databases": [
    {
      "type": "dynamodb",
      "name": "svcFeatureFlags-{env}",
      "description": "Feature flag definitions and shop-level overrides"
    }
  ]
})

export default svc_feature_flags
