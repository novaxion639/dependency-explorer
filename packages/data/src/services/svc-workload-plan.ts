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
      "type": "mongodb",
      "name": "svc-workload-plan",
      "description": "V2 store — workload plans and rules (WorkloadPlanManagerV2 on Mongo repositories, SSM {serviceName}/MONGO_DB_URI). The DynamoDB→MongoDB migration is ONGOING, not complete: the V1 WorkloadPlanController still serves reads/writes from the DynamoDB-backed WorkloadPlanManager, and TriggerDynamoToFullLoadSqsJobHandler replicates dynamo→mongo (re-verified 2026-07-11 — the 2026-06-10 'no longer bound' correction was wrong against current code)."
    },
    {
      "type": "dynamodb",
      "name": "workloadPlan (V1)",
      "description": "Legacy V1 store still live during the Mongo migration: bound in the container (WorkloadPlanManager) and consumed by WorkloadPlanController; its table stream feeds the dynamo→mongo replication and the two own-stream listeners seen in serverless config. Surfaced by the AWS client-usage discovery pass, 2026-07-11."
    },
    {
      "type": "sqs",
      "name": "svc-workload-plan-dlq",
      "description": "Failed plan computation retry queue"
    }
  ]
})

export default svc_workload_plan
