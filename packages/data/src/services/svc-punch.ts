import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_punch: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-punch",
  "type": "typescript-microservice",
  "description": "Punch-clock attendance tracking — records clock-in/out events and computes worked time",
  "endpoints": [
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
      "id": "api-public-swagger-index",
      "path": "/public",
      "method": "GET",
      "description": "Shows public swagger",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-public-swagger-docs",
      "path": "/public/docs.json",
      "method": "GET",
      "description": "Shows docs of public swagger",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-config-read",
      "path": "/config",
      "method": "GET",
      "description": "Reads config for tablets",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-clocks-in-out-read-by-id",
      "path": "/clocks-in-out/{id}",
      "method": "GET",
      "description": "Reads one clockInOut",
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
      "id": "api-clocks-in-out-by-multiple-shop-ids",
      "path": "/v1/clocks-in-out/shops",
      "method": "GET",
      "description": "Reads clocksInOut by multiple shop Ids",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-clocks-in-out-by-multiple-user-ids",
      "path": "/v1/clocks-in-out/users",
      "method": "GET",
      "description": "Reads clocksInOut by multiple user Ids",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-public-clocks-in-out-public-create",
      "path": "/v1/clocks-in-out",
      "method": "POST",
      "description": "Creates clockInOut public",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-public-clocks-in-out-public-update",
      "path": "/v1/clocks-in-out",
      "method": "PATCH",
      "description": "Updates clockInOut public",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-clocks-in-out-by-shop-id",
      "path": "/clocks-in-out/shop/{shopId}",
      "method": "GET",
      "description": "Reads clocksInOut by shopId",
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
      "id": "api-clocks-in-out-by-user-id",
      "path": "/clocks-in-out/user/{userId}",
      "method": "GET",
      "description": "Reads clocksInOut by userId",
      "useCase": "",
      "params": [
        {
          "name": "userId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-clocks-in-out-update",
      "path": "/clocks-in-out/{id}",
      "method": "PUT",
      "description": "Updates one clockInOut",
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
      "id": "api-histories-read-by-id",
      "path": "/histories/{id}",
      "method": "GET",
      "description": "Reads one history",
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
      "id": "api-histories-by-shop-id",
      "path": "/histories/shop/{shopId}",
      "method": "GET",
      "description": "Reads history by shopId",
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
      "id": "api-histories-create",
      "path": "/histories",
      "method": "POST",
      "description": "Creates one history",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-setting-read-by-shop-id",
      "path": "/settings/shop/{shopId}",
      "method": "GET",
      "description": "Reads settings by shopId",
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
      "id": "api-setting-read-by-shop-id-2",
      "path": "/settings/{shopId}",
      "method": "GET",
      "description": "Reads settings by shopId",
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
      "id": "api-setting-update",
      "path": "/settings/shop/{shopId}",
      "method": "PUT",
      "description": "Updates one setting",
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
      "id": "api-setting-update-2",
      "path": "/settings/{shopId}",
      "method": "PUT",
      "description": "Updates one setting",
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
      "id": "api-setting-partial-update",
      "path": "/settings/shop/{shopId}",
      "method": "PATCH",
      "description": "Patch one setting",
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
      "id": "api-setting-partial-update-2",
      "path": "/settings/{shopId}",
      "method": "PATCH",
      "description": "Patch one setting",
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
      "id": "api-setting-partial-update-by-mobile",
      "path": "/settings/mobile/{shopId}",
      "method": "PATCH",
      "description": "Patch one setting by shop id for mobile",
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
      "id": "api-setting-delete",
      "path": "/settings/shop/{shopId}",
      "method": "DELETE",
      "description": "Deletes one setting",
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
      "id": "api-setting-delete-2",
      "path": "/settings/{shopId}",
      "method": "DELETE",
      "description": "Deletes one setting",
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
      "id": "api-users-read-by-id",
      "path": "/users/{id}",
      "method": "GET",
      "description": "Reads one user",
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
      "id": "api-users-by-shop-id",
      "path": "/users/shop/{shopId}",
      "method": "GET",
      "description": "Reads clocksInOut by shopId",
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
      "id": "api-users-by-user-id",
      "path": "/users/user/{userId}",
      "method": "GET",
      "description": "Reads clocksInOut by userId",
      "useCase": "",
      "params": [
        {
          "name": "userId",
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
