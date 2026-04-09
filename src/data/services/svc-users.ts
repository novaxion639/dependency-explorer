import { ConnectivityServiceSchema } from '../schemas'
import type { ConnectivityService } from '../schemas'

const svc_users: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-users",
  "type": "typescript-microservice",
  "description": "User identity and authentication management",
  "endpoints": [
    {
      "id": "api-login-capability",
      "path": "/login/capability",
      "method": "GET",
      "description": "Get login capability (SSO vs password, etc.)",
      "useCase": "Used by calling services to get login capability (SSO vs password, etc.)",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcUsers-{env}"
        },
        {
          "type": "postgresql",
          "name": "svc_users"
        }
      ]
    },
    {
      "id": "api-sso-callback",
      "path": "/sso/{provider}/callback",
      "method": "GET",
      "description": "SSO provider callback",
      "useCase": "Used by calling services to sSO provider callback",
      "params": [
        {
          "name": "provider",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "provider identifier"
        }
      ],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcUsers-{env}"
        },
        {
          "type": "postgresql",
          "name": "svc_users"
        }
      ]
    },
    {
      "id": "api-get-sso-configuration-by-organisation",
      "path": "/sso-configurations",
      "method": "GET",
      "description": "Get SSO configuration by organisation",
      "useCase": "Used by calling services to get SSO configuration by organisation",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcUsers-{env}"
        },
        {
          "type": "postgresql",
          "name": "svc_users"
        }
      ]
    },
    {
      "id": "api-create-or-update-sso-configuration",
      "path": "/sso-configurations",
      "method": "POST",
      "description": "Create or update SSO configuration",
      "useCase": "Used by calling services to create or update SSO configuration",
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
          "name": "svcUsers-{env}"
        },
        {
          "type": "postgresql",
          "name": "svc_users"
        }
      ]
    },
    {
      "id": "docs-swagger-api",
      "path": "/docs",
      "method": "GET",
      "description": "Swagger API docs",
      "useCase": "Used by calling services to swagger API docs",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcUsers-{env}"
        },
        {
          "type": "postgresql",
          "name": "svc_users"
        }
      ]
    },
    {
      "id": "docs-public-swagger-api",
      "path": "/public/docs",
      "method": "GET",
      "description": "Public Swagger API docs",
      "useCase": "Used by calling services to public Swagger API docs",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcUsers-{env}"
        },
        {
          "type": "postgresql",
          "name": "svc_users"
        }
      ]
    }
  ],
  "databases": [
    {
      "type": "dynamodb",
      "name": "svcUsers-{env}",
      "description": "User authentication tokens and SSO sessions"
    },
    {
      "type": "postgresql",
      "name": "svc_users",
      "description": "User accounts and capability grants (relational)"
    }
  ]
})

export default svc_users
