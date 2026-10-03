import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

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
          "name": "svcrequests-{env}"
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
          "name": "svcrequests-{env}"
        },
        {
          "type": "sns",
          "name": "svcRequests-dispatch-{env}"
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
          "name": "svcrequests-{env}"
        },
        {
          "type": "sns",
          "name": "svcRequests-dispatch-{env}"
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
          "name": "svcrequests-{env}"
        },
        {
          "type": "sns",
          "name": "svcRequests-dispatch-{env}"
        }
      ]
    },
    {
      "id": "leave-request-get-one-api",
      "path": "/leave-requests/{id}",
      "method": "GET",
      "description": "GET /leave-requests/{id}",
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
      "id": "leave-request-get-pre-selected-manager-api",
      "path": "/selected-manager",
      "method": "GET",
      "description": "GET /selected-manager",
      "useCase": "",
      "params": [],
      "response": {}
    }
  ],
  "databases": [
    {
      "type": "postgresql",
      "name": "svcrequests-{env}",
      "description": "Leave requests and availability rules (relational)"
    },
    {
      "type": "sns",
      "name": "svcRequests-dispatch-{env}",
      "description": "Request state change notifications"
    }
  ]
})

export default svc_requests
