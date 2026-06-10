import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_users: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-users",
  "type": "typescript-microservice",
  "description": "User identity and authentication management",
  "endpoints": [
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
          "name": "skelloapp RDS read-replica (db_url_svc_users-ro)"
        }
      ]
    },
    {
      "id": "api-get-sso-configuration-by-organisation",
      "path": "/sso/config/{organisationId}",
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
          "name": "skelloapp RDS read-replica (db_url_svc_users-ro)"
        }
      ]
    },
    {
      "id": "api-create-or-update-sso-configuration",
      "path": "/sso/config/{organisationId}",
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
          "name": "skelloapp RDS read-replica (db_url_svc_users-ro)"
        }
      ]
    },
    {
      "id": "api-public-swagger-docs",
      "path": "/public/docs.json",
      "method": "GET",
      "description": "GET /public/docs.json",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-get-user",
      "path": "/user/me",
      "method": "GET",
      "description": "Get authenticated user profile",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-patch-user",
      "path": "/user/me",
      "method": "PATCH",
      "description": "Patch user profile",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-confirm-user",
      "path": "/private/user-confirm",
      "method": "POST",
      "description": "Confirm a user by email",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-token-employee",
      "path": "/token-employee",
      "method": "POST",
      "description": "Generate fresh tokens scoped to a target employee credentials",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-change-password",
      "path": "/user/me/password",
      "method": "PATCH",
      "description": "Change authenticated user password",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-invite-user",
      "path": "/invitation",
      "method": "POST",
      "description": "Invite a user to join Skello",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-invite-user-2",
      "path": "/private/invitation",
      "method": "POST",
      "description": "Invite a user to join Skello",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-check-user-exists",
      "path": "/private/user-exists",
      "method": "POST",
      "description": "Check if a user exists by email (private, API key protected)",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "login-capability",
      "path": "/login/_capability",
      "method": "POST",
      "description": "POST /login/_capability",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-sign-up",
      "path": "/sign-up",
      "method": "POST",
      "description": "Account sign-up — served via the ALB entry (auth.skello.io), not the API Gateway, which is why the serverless scan misses it. Evidence: SDK signUp() method + the 2026-04 SvcUsers architecture board (SignUp Lambda → DynamoDB).",
      "useCase": "",
      "params": [],
      "response": {},
      "provenance": {
        "source": "manual",
        "lastVerified": "2026-06-10",
        "evidence": "svc-users-sdk signUp() + https://www.figma.com/board/ioDtRODjqmMuKaIzNgh0gW"
      }
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
      "name": "skelloapp RDS read-replica (db_url_svc_users-ro)",
      "description": "NOT an owned store — read-only access to the monolith's RDS replica with a dedicated svc_users credential (SSM /skl/{env}/skelloapp/rds/db_url_svc_users-ro; SkelloAppUserEntity, licenses, prospects). The 'postgresql svc_users' box on the 2026-04 board is this replica. Corrected 2026-06-10."
    }
  ]
})

export default svc_users
