import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_punch: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-punch",
  "type": "typescript-microservice",
  "description": "Punch-clock attendance tracking — records clock-in/out events and computes worked time",
  "endpoints": [
    {
      "id": "api-get-clocks-in-out",
      "path": "/clocks-in-out",
      "method": "GET",
      "description": "Get clocks in/out records",
      "useCase": "Used by calling services to get clocks in/out records",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcPunch-{env}"
        }
      ]
    },
    {
      "id": "api-create-clock-in-out",
      "path": "/clocks-in-out",
      "method": "POST",
      "description": "Create clock in/out record",
      "useCase": "Used by calling services to create clock in/out record",
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
          "name": "svcPunch-{env}"
        }
      ]
    },
    {
      "id": "api-update-clock-in-out",
      "path": "/clocks-in-out/{id}",
      "method": "PATCH",
      "description": "Update clock in/out record",
      "useCase": "Used by calling services to update clock in/out record",
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
          "name": "svcPunch-{env}"
        }
      ]
    },
    {
      "id": "api-delete-clock-in-out",
      "path": "/clocks-in-out/{id}",
      "method": "DELETE",
      "description": "Delete clock in/out record",
      "useCase": "Used by calling services to delete clock in/out record",
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
          "name": "svcPunch-{env}"
        }
      ]
    },
    {
      "id": "api-get-punch-settings",
      "path": "/settings",
      "method": "GET",
      "description": "Get punch settings",
      "useCase": "Used by calling services to get punch settings",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcPunch-{env}"
        }
      ]
    },
    {
      "id": "api-upsert-punch-settings",
      "path": "/settings",
      "method": "POST",
      "description": "Upsert punch settings",
      "useCase": "Used by calling services to upsert punch settings",
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
          "name": "svcPunch-{env}"
        }
      ]
    },
    {
      "id": "api-get-punch-histories",
      "path": "/histories",
      "method": "GET",
      "description": "Get punch histories",
      "useCase": "Used by calling services to get punch histories",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcPunch-{env}"
        }
      ]
    },
    {
      "id": "api-get-punch-users",
      "path": "/users",
      "method": "GET",
      "description": "Get punch users",
      "useCase": "Used by calling services to get punch users",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcPunch-{env}"
        }
      ]
    },
    {
      "id": "api-create-punch-user",
      "path": "/users",
      "method": "POST",
      "description": "Create punch user",
      "useCase": "Used by calling services to create punch user",
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
          "name": "svcPunch-{env}"
        }
      ]
    },
    {
      "id": "api-update-punch-user",
      "path": "/users/{userId}",
      "method": "PATCH",
      "description": "Update punch user",
      "useCase": "Used by calling services to update punch user",
      "params": [
        {
          "name": "userId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "userId identifier"
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
          "name": "svcPunch-{env}"
        }
      ]
    },
    {
      "id": "api-delete-punch-user",
      "path": "/users/{userId}",
      "method": "DELETE",
      "description": "Delete punch user",
      "useCase": "Used by calling services to delete punch user",
      "params": [
        {
          "name": "userId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "userId identifier"
        }
      ],
      "response": {
        "204": "Deleted",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcPunch-{env}"
        }
      ]
    },
    {
      "id": "api-get-punch-mobile-permissions",
      "path": "/mobile-permissions",
      "method": "GET",
      "description": "Get punch mobile permissions",
      "useCase": "Used by calling services to get punch mobile permissions",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcPunch-{env}"
        }
      ]
    },
    {
      "id": "api-upsert-punch-mobile-permissions",
      "path": "/mobile-permissions",
      "method": "POST",
      "description": "Upsert punch mobile permissions",
      "useCase": "Used by calling services to upsert punch mobile permissions",
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
          "name": "svcPunch-{env}"
        }
      ]
    },
    {
      "id": "api-get-v1-clocks-in-out",
      "path": "/v1/public/clocks-in-out",
      "method": "GET",
      "description": "Public v1 get clocks in/out",
      "useCase": "Used by calling services to public v1 get clocks in/out",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcPunch-{env}"
        }
      ]
    },
    {
      "id": "api-create-v1-clock-in-out",
      "path": "/v1/public/clocks-in-out",
      "method": "POST",
      "description": "Public v1 create clock in/out",
      "useCase": "Used by calling services to public v1 create clock in/out",
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
          "name": "svcPunch-{env}"
        }
      ]
    },
    {
      "id": "api-update-v1-clock-in-out",
      "path": "/v1/public/clocks-in-out/{id}",
      "method": "PATCH",
      "description": "Public v1 update clock in/out",
      "useCase": "Used by calling services to public v1 update clock in/out",
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
          "name": "svcPunch-{env}"
        }
      ]
    },
    {
      "id": "api-delete-v1-clock-in-out",
      "path": "/v1/public/clocks-in-out/{id}",
      "method": "DELETE",
      "description": "Public v1 delete clock in/out",
      "useCase": "Used by calling services to public v1 delete clock in/out",
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
          "name": "svcPunch-{env}"
        }
      ]
    },
    {
      "id": "api-get-v1-punch-settings",
      "path": "/v1/public/settings",
      "method": "GET",
      "description": "Public v1 get punch settings",
      "useCase": "Used by calling services to public v1 get punch settings",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcPunch-{env}"
        }
      ]
    },
    {
      "id": "api-upsert-v1-punch-settings",
      "path": "/v1/public/settings",
      "method": "POST",
      "description": "Public v1 upsert punch settings",
      "useCase": "Used by calling services to public v1 upsert punch settings",
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
          "name": "svcPunch-{env}"
        }
      ]
    },
    {
      "id": "api-get-v1-punch-users",
      "path": "/v1/public/users",
      "method": "GET",
      "description": "Public v1 get punch users",
      "useCase": "Used by calling services to public v1 get punch users",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcPunch-{env}"
        }
      ]
    }
  ],
  "databases": [
    {
      "type": "dynamodb",
      "name": "svcPunch-{env}",
      "description": "Punch clock records — clock-in/out events per employee"
    },
    {
      "type": "sqs",
      "name": "svc-punch-dlq",
      "description": "Retry queue for failed punch sync"
    }
  ]
})

export default svc_punch
