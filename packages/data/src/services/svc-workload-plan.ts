import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_workload_plan: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-workload-plan",
  "type": "typescript-microservice",
  "description": "Workload forecasting — predicts staffing needs based on POS revenue and historical patterns",
  "endpoints": [
    {
      "id": "api-get-workload-plans-v1",
      "path": "/workload-plans",
      "method": "GET",
      "description": "Get workload plans (v1)",
      "useCase": "Used by calling services to get workload plans (v1)",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcWorkloadPlan-{env}"
        },
        {
          "type": "mongodb",
          "name": "svc-workload-plan"
        }
      ]
    },
    {
      "id": "api-create-workload-plan-v1",
      "path": "/workload-plans",
      "method": "POST",
      "description": "Create workload plan (v1)",
      "useCase": "Used by calling services to create workload plan (v1)",
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
          "name": "svcWorkloadPlan-{env}"
        },
        {
          "type": "mongodb",
          "name": "svc-workload-plan"
        }
      ]
    },
    {
      "id": "api-get-workload-plans-v2",
      "path": "/v2/workload-plans",
      "method": "GET",
      "description": "Get workload plans (v2)",
      "useCase": "Used by calling services to get workload plans (v2)",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcWorkloadPlan-{env}"
        },
        {
          "type": "mongodb",
          "name": "svc-workload-plan"
        }
      ]
    },
    {
      "id": "api-create-workload-plan-v2",
      "path": "/v2/workload-plans",
      "method": "POST",
      "description": "Create workload plan (v2)",
      "useCase": "Used by calling services to create workload plan (v2)",
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
          "name": "svcWorkloadPlan-{env}"
        },
        {
          "type": "mongodb",
          "name": "svc-workload-plan"
        }
      ]
    },
    {
      "id": "api-create-workload-rule-v2",
      "path": "/v2/workload-rules",
      "method": "POST",
      "description": "Create workload rule (v2)",
      "useCase": "Used by calling services to create workload rule (v2)",
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
          "name": "svcWorkloadPlan-{env}"
        },
        {
          "type": "mongodb",
          "name": "svc-workload-plan"
        }
      ]
    },
    {
      "id": "api-v2-workload-rules-index",
      "path": "/v2/workload-rules/{shopId}",
      "method": "GET",
      "description": "[V2] Get the paginated shop workload rules",
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
      "id": "api-v2-delete-workload-rule-by-skello-id",
      "path": "/v2/workload-rules/{skelloId}",
      "method": "DELETE",
      "description": "Delete the workload rule by Skello ID",
      "useCase": "",
      "params": [
        {
          "name": "skelloId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-v2-delete-workload-rule-by-shop-id",
      "path": "/v2/workload-rules/by-shop/{shopId}",
      "method": "DELETE",
      "description": "Delete the workload rule by Shop ID",
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
      "id": "api-v2-workload-rules-update",
      "path": "/v2/workload-rules/{skelloId}",
      "method": "PUT",
      "description": "[V2] Update an existing workload rule",
      "useCase": "",
      "params": [
        {
          "name": "skelloId",
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
      "name": "svcWorkloadPlan-{env}",
      "description": "Workload plans and staffing forecast records"
    },
    {
      "type": "mongodb",
      "name": "svc-workload-plan",
      "description": "Historical workload data for forecast models"
    },
    {
      "type": "sqs",
      "name": "svc-workload-plan-dlq",
      "description": "Failed plan computation retry queue"
    }
  ]
})

export default svc_workload_plan
