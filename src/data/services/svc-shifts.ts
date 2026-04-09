import { ConnectivityServiceSchema } from '../schemas'
import type { ConnectivityService } from '../schemas'

const svc_shifts: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-shifts",
  "type": "typescript-microservice",
  "description": "Shift scheduling engine — CRUD for shifts, validations and publication",
  "endpoints": [
    {
      "id": "api-get-employee-shift-metrics",
      "path": "/shift-metrics/employee",
      "method": "POST",
      "description": "Get shift metrics for an employee",
      "useCase": "Used by calling services to get shift metrics for an employee",
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
          "name": "svc-shifts"
        }
      ]
    },
    {
      "id": "api-get-employees-for-shifts",
      "path": "/employees-for-shifts",
      "method": "POST",
      "description": "Get employees eligible for shifts",
      "useCase": "Used by calling services to get employees eligible for shifts",
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
          "name": "svc-shifts"
        }
      ]
    },
    {
      "id": "api-get-shop-and-orga-shift-metrics",
      "path": "/shift-metrics/shop-and-orga",
      "method": "POST",
      "description": "Get shift metrics for shop and organisation",
      "useCase": "Used by calling services to get shift metrics for shop and organisation",
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
          "name": "svc-shifts"
        }
      ]
    },
    {
      "id": "api-get-shift-details",
      "path": "/shift-details",
      "method": "POST",
      "description": "Get shift details",
      "useCase": "Used by calling services to get shift details",
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
          "name": "svc-shifts"
        }
      ]
    }
  ],
  "databases": [
    {
      "type": "mongodb",
      "name": "svc-shifts",
      "description": "Shift metrics and employee aggregated shift data"
    }
  ]
})

export default svc_shifts
