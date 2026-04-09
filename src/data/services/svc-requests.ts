import { ConnectivityServiceSchema } from '../schemas'
import type { ConnectivityService } from '../schemas'

const svc_requests: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-requests",
  "type": "typescript-microservice",
  "description": "Leave and absence request workflow — creation, approval chains and calendar sync",
  "endpoints": [
    {
      "id": "api-get-leave-requests",
      "path": "/leave-requests",
      "method": "GET",
      "description": "Get leave requests",
      "useCase": "Used by calling services to get leave requests",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "postgresql",
          "name": "svc_requests"
        }
      ]
    },
    {
      "id": "api-create-leave-request",
      "path": "/leave-requests",
      "method": "POST",
      "description": "Create leave request",
      "useCase": "Used by calling services to create leave request",
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
          "type": "postgresql",
          "name": "svc_requests"
        },
        {
          "type": "sns",
          "name": "svc-requests-sns"
        }
      ]
    },
    {
      "id": "api-update-leave-request",
      "path": "/leave-requests/{id}",
      "method": "PATCH",
      "description": "Update leave request",
      "useCase": "Used by calling services to update leave request",
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
          "type": "postgresql",
          "name": "svc_requests"
        },
        {
          "type": "sns",
          "name": "svc-requests-sns"
        }
      ]
    },
    {
      "id": "api-delete-leave-request",
      "path": "/leave-requests/{id}",
      "method": "DELETE",
      "description": "Delete leave request",
      "useCase": "Used by calling services to delete leave request",
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
          "type": "postgresql",
          "name": "svc_requests"
        },
        {
          "type": "sns",
          "name": "svc-requests-sns"
        }
      ]
    },
    {
      "id": "api-get-leave-request-selected-manager",
      "path": "/leave-requests/{id}/selected-manager",
      "method": "GET",
      "description": "Get selected manager for leave request",
      "useCase": "Used by calling services to get selected manager for leave request",
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
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "postgresql",
          "name": "svc_requests"
        }
      ]
    },
    {
      "id": "api-update-leave-request-selected-manager",
      "path": "/leave-requests/{id}/selected-manager",
      "method": "PATCH",
      "description": "Update selected manager for leave request",
      "useCase": "Used by calling services to update selected manager for leave request",
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
          "type": "postgresql",
          "name": "svc_requests"
        },
        {
          "type": "sns",
          "name": "svc-requests-sns"
        }
      ]
    }
  ],
  "databases": [
    {
      "type": "postgresql",
      "name": "svc_requests",
      "description": "Leave requests and availability rules (relational)"
    },
    {
      "type": "sns",
      "name": "svc-requests-sns",
      "description": "Request state change notifications"
    }
  ]
})

export default svc_requests
