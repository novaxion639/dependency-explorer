import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_feature_flags: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-feature-flags",
  "type": "typescript-microservice",
  "description": "Feature flag management — controls feature rollout per account, percentage or user group",
  "endpoints": [
    {
      "id": "api-get-feature-flags",
      "path": "/feature-flags",
      "method": "GET",
      "description": "Get feature flags",
      "useCase": "Used by calling services to get feature flags",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcFeatureFlags-{env}"
        }
      ]
    },
    {
      "id": "api-create-feature-flag",
      "path": "/feature-flags",
      "method": "POST",
      "description": "Create feature flag",
      "useCase": "Used by calling services to create feature flag",
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
          "name": "svcFeatureFlags-{env}"
        }
      ]
    },
    {
      "id": "api-update-feature-flag",
      "path": "/feature-flags/{flagId}",
      "method": "PATCH",
      "description": "Update feature flag",
      "useCase": "Used by calling services to update feature flag",
      "params": [
        {
          "name": "flagId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "flagId identifier"
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
          "name": "svcFeatureFlags-{env}"
        }
      ]
    },
    {
      "id": "api-delete-feature-flag",
      "path": "/feature-flags/{flagId}",
      "method": "DELETE",
      "description": "Delete feature flag",
      "useCase": "Used by calling services to delete feature flag",
      "params": [
        {
          "name": "flagId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "flagId identifier"
        }
      ],
      "response": {
        "204": "Deleted",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcFeatureFlags-{env}"
        }
      ]
    },
    {
      "id": "api-get-feature-flags-dev",
      "path": "/feature-flags-dev",
      "method": "GET",
      "description": "Get dev feature flags",
      "useCase": "Used by calling services to get dev feature flags",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcFeatureFlags-{env}"
        }
      ]
    },
    {
      "id": "api-create-feature-flag-dev",
      "path": "/feature-flags-dev",
      "method": "POST",
      "description": "Create dev feature flag",
      "useCase": "Used by calling services to create dev feature flag",
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
          "name": "svcFeatureFlags-{env}"
        }
      ]
    },
    {
      "id": "api-delete-feature-flag-dev",
      "path": "/feature-flags-dev/{flagId}",
      "method": "DELETE",
      "description": "Delete dev feature flag",
      "useCase": "Used by calling services to delete dev feature flag",
      "params": [
        {
          "name": "flagId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "flagId identifier"
        }
      ],
      "response": {
        "204": "Deleted",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcFeatureFlags-{env}"
        }
      ]
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
