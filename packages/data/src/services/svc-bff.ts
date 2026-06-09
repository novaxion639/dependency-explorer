import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_bff: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-bff",
  "type": "typescript-microservice",
  "description": "Backend-For-Frontend — aggregates data from multiple services into optimised frontend payloads",
  "endpoints": [
    {
      "id": "api-orchestrate-documents",
      "path": "/v1/documents",
      "method": "POST",
      "description": "BFF orchestration for documents",
      "useCase": "Used by calling services to bFF orchestration for documents",
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
          "name": "svcBff-{env}"
        }
      ]
    },
    {
      "id": "api-bulk-update-kpis",
      "path": "/v1/kpis",
      "method": "POST",
      "description": "BFF bulk update KPIs",
      "useCase": "Used by calling services to bFF bulk update KPIs",
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
          "name": "svcBff-{env}"
        }
      ]
    },
    {
      "id": "api-get-payroll-anomalies",
      "path": "/v1/payroll-anomalies",
      "method": "GET",
      "description": "Fetches payroll anomalies",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-month-planning-initial-load",
      "path": "/v1/plannings/month/load",
      "method": "GET",
      "description": "Returns aggregated initial-load data for the month planning view",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-plannings-employee-rows",
      "path": "/v1/plannings/employee-rows",
      "method": "GET",
      "description": "Returns employee rows (shifts, counters, alerts…) for the month planning grid",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-compute-template-variables",
      "path": "/v1/templates/{id}/variables-values",
      "method": "POST",
      "description": "POST /v1/templates/{id}/variables-values",
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
      "id": "api-list-template-variables",
      "path": "/v1/templates/variables",
      "method": "GET",
      "description": "GET /v1/templates/variables",
      "useCase": "",
      "params": [],
      "response": {}
    }
  ],
  "databases": [
    {
      "type": "dynamodb",
      "name": "svcBff-{env}",
      "description": "BFF request cache and orchestration state"
    }
  ]
})

export default svc_bff
