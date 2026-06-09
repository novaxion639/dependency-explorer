import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_kpis_v2: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-kpis-v2",
  "type": "typescript-microservice",
  "description": "Real-time KPI computation and dashboarding — labour costs, productivity and turnover metrics",
  "endpoints": [
    {
      "id": "api-get-activity-prediction-settings",
      "path": "/activity-prediction/settings",
      "method": "GET",
      "description": "Get activity prediction settings",
      "useCase": "Used by calling services to get activity prediction settings",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "mongodb",
          "name": "svc-kpis-v2"
        }
      ]
    },
    {
      "id": "api-upsert-activity-prediction-settings",
      "path": "/activity-prediction/settings",
      "method": "POST",
      "description": "Upsert activity prediction settings",
      "useCase": "Used by calling services to upsert activity prediction settings",
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
          "name": "svc-kpis-v2"
        }
      ]
    },
    {
      "id": "api-get-reference-week",
      "path": "/reference-week",
      "method": "GET",
      "description": "Get reference week data",
      "useCase": "Used by calling services to get reference week data",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "mongodb",
          "name": "svc-kpis-v2"
        }
      ]
    },
    {
      "id": "api-upsert-reference-week",
      "path": "/reference-week",
      "method": "POST",
      "description": "Upsert reference week data",
      "useCase": "Used by calling services to upsert reference week data",
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
          "name": "svc-kpis-v2"
        }
      ]
    },
    {
      "id": "api-get-kpis",
      "path": "/kpis",
      "method": "GET",
      "description": "Get KPIs",
      "useCase": "Used by calling services to get KPIs",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "mongodb",
          "name": "svc-kpis-v2"
        }
      ]
    },
    {
      "id": "api-create-kpis",
      "path": "/kpis",
      "method": "POST",
      "description": "Create KPIs",
      "useCase": "Used by calling services to create KPIs",
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
          "name": "svc-kpis-v2"
        }
      ]
    },
    {
      "id": "api-update-kpis",
      "path": "/kpis/{kpiId}",
      "method": "PATCH",
      "description": "Update KPI",
      "useCase": "Used by calling services to update KPI",
      "params": [
        {
          "name": "kpiId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "kpiId identifier"
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
          "type": "mongodb",
          "name": "svc-kpis-v2"
        }
      ]
    }
  ],
  "databases": [
    {
      "type": "mongodb",
      "name": "svc-kpis-v2",
      "description": "KPI time-series data — revenue, labour cost, hours"
    }
  ]
})

export default svc_kpis_v2
