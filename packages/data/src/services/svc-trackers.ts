import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_trackers: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-trackers",
  "type": "typescript-microservice",
  "description": "Time tracker — project and task-based time logging across the workforce",
  "endpoints": [
    {
      "id": "api-activate-shop-tracker-settings",
      "path": "/shop-settings/activate",
      "method": "POST",
      "description": "Activate shop tracker settings",
      "useCase": "Used by calling services to activate shop tracker settings",
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
          "type": "mongodb",
          "name": "svc-trackers"
        }
      ]
    },
    {
      "id": "api-list-shop-tracker-settings",
      "path": "/shop-settings",
      "method": "GET",
      "description": "List shop tracker settings",
      "useCase": "Used by calling services to list shop tracker settings",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "mongodb",
          "name": "svc-trackers"
        }
      ]
    },
    {
      "id": "api-deactivate-shop-tracker-settings",
      "path": "/shop-settings/deactivate",
      "method": "POST",
      "description": "Deactivate shop tracker settings",
      "useCase": "Used by calling services to deactivate shop tracker settings",
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
          "type": "mongodb",
          "name": "svc-trackers"
        }
      ]
    },
    {
      "id": "api-get-employee-tracker-settings",
      "path": "/employee-settings",
      "method": "GET",
      "description": "Get employee tracker settings",
      "useCase": "Used by calling services to get employee tracker settings",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "mongodb",
          "name": "svc-trackers"
        }
      ]
    },
    {
      "id": "api-upsert-employee-tracker-settings",
      "path": "/employee-settings",
      "method": "POST",
      "description": "Upsert employee tracker settings",
      "useCase": "Used by calling services to upsert employee tracker settings",
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
          "type": "mongodb",
          "name": "svc-trackers"
        }
      ]
    },
    {
      "id": "api-get-trackers",
      "path": "/trackers",
      "method": "GET",
      "description": "Get trackers",
      "useCase": "Used by calling services to get trackers",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "mongodb",
          "name": "svc-trackers"
        }
      ]
    },
    {
      "id": "api-upsert-tracker",
      "path": "/trackers",
      "method": "POST",
      "description": "Upsert tracker",
      "useCase": "Used by calling services to upsert tracker",
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
          "type": "mongodb",
          "name": "svc-trackers"
        }
      ]
    }
  ],
  "databases": [
    {
      "type": "mongodb",
      "name": "svc-trackers",
      "description": "Tracker settings and geofencing rules per shop"
    }
  ]
})

export default svc_trackers
