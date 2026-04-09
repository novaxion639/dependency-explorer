import { ConnectivityServiceSchema } from '../schemas'
import type { ConnectivityService } from '../schemas'

const svc_enrollment: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-enrollment",
  "type": "typescript-microservice",
  "description": "Account onboarding orchestration — manages multi-step setup flow for new accounts",
  "endpoints": [
    {
      "id": "api-get-onboardings",
      "path": "/onboardings",
      "method": "GET",
      "description": "Get onboardings",
      "useCase": "Used by calling services to get onboardings",
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
      "id": "api-update-onboarding",
      "path": "/onboardings/{id}",
      "method": "PATCH",
      "description": "Update onboarding",
      "useCase": "Used by calling services to update onboarding",
      "params": [
        {
          "name": "id",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "id identifier"
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
          "name": "svcEnrollment-{env}"
        },
        {
          "type": "s3",
          "name": "svc-enrollment.conventions.{env}"
        }
      ]
    },
    {
      "id": "api-delete-onboarding",
      "path": "/onboardings/{id}",
      "method": "DELETE",
      "description": "Delete onboarding",
      "useCase": "Used by calling services to delete onboarding",
      "params": [
        {
          "name": "id",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "id identifier"
        }
      ],
      "response": {
        "204": "Deleted",
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
