import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_enrollment: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-enrollment",
  "type": "typescript-microservice",
  "description": "Account onboarding orchestration — manages multi-step setup flow for new accounts",
  "endpoints": [
    {
      "id": "api-create-onboarding",
      "path": "/onboardings",
      "method": "POST",
      "description": "Create onboarding",
      "useCase": "Used by calling services to create onboarding",
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
          "name": "svcEnrollment-{env}"
        },
        {
          "type": "s3",
          "name": "svc-enrollment.conventions.{env}"
        }
      ]
    },
    {
      "id": "api-get-collective-agreements",
      "path": "/collective-agreements",
      "method": "GET",
      "description": "Get collective agreements",
      "useCase": "Used by calling services to get collective agreements",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcEnrollment-{env}"
        },
        {
          "type": "s3",
          "name": "svc-enrollment.conventions.{env}"
        }
      ]
    },
    {
      "id": "create-onboarding-config-api",
      "path": "/shop/{shopId}/onboarding/config",
      "method": "POST",
      "description": "Creates employee onboarding config and upserts shop onboarding config",
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
      "id": "get-shop-onboarding-config-api",
      "path": "/shop/{shopId}/onboarding/config",
      "method": "GET",
      "description": "Gets shop onboarding config for a given shopId",
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
      "id": "get-employee-onboarding-config-api",
      "path": "/employee/{employeeId}/onboarding/config",
      "method": "GET",
      "description": "Gets employee onboarding config for a given employeeId",
      "useCase": "",
      "params": [
        {
          "name": "employeeId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "update-employee-onboarding-config-api",
      "path": "/employee/{employeeId}/onboarding/config",
      "method": "PATCH",
      "description": "Updates employee onboarding config for a given employeeId",
      "useCase": "",
      "params": [
        {
          "name": "employeeId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "onboarding-get-one-api",
      "path": "/onboardings/{flow}/{shopId}",
      "method": "GET",
      "description": "Gets one onboarding",
      "useCase": "",
      "params": [
        {
          "name": "flow",
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
      "id": "onboarding-get-all-api",
      "path": "/onboardings/{shopId}",
      "method": "GET",
      "description": "Gets all onboardings for a given shopId",
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
      "id": "onboarding-update-api",
      "path": "/onboardings/{flow}/{shopId}",
      "method": "PATCH",
      "description": "Updates an existing onboarding",
      "useCase": "",
      "params": [
        {
          "name": "flow",
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
    }
  ],
  "databases": [
    {
      "type": "dynamodb",
      "name": "svcEnrollment-{env}",
      "description": "Onboarding flows and shop enrollment state"
    },
    {
      "type": "s3",
      "name": "svc-enrollment.conventions.{env}",
      "description": "Collective agreement documents"
    }
  ]
})

export default svc_enrollment
