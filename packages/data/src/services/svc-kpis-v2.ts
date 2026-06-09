import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_kpis_v2: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-kpis-v2",
  "type": "typescript-microservice",
  "description": "Real-time KPI computation and dashboarding — labour costs, productivity and turnover metrics",
  "endpoints": [
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
      "id": "api-read-setting-activity-prediction",
      "path": "/setting/activity-prediction/{shopId}",
      "method": "GET",
      "description": "Get the activity prediction settings for a shop",
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
      "id": "api-upsert-setting-activity-prediction",
      "path": "/setting/activity-prediction/{shopId}",
      "method": "PUT",
      "description": "Create or update the activity prediction settings for a shop",
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
      "id": "fetch-activity-prediction-reference-week",
      "path": "/setting/activity-prediction/{shopId}/reference-week",
      "method": "GET",
      "description": "Fetch the activity prediction reference week by shop ID",
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
      "id": "update-manual-kpis-bulk",
      "path": "/kpis-manual/_bulk",
      "method": "PATCH",
      "description": "Update the manual kpis in bulk",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "upsert-activity-prediction-reference-week",
      "path": "/setting/activity-prediction/{shopId}/reference-week",
      "method": "PUT",
      "description": "Upsert the activity prediction reference week for provided shop",
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
