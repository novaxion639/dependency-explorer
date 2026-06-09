import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_employees: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-employees",
  "type": "typescript-microservice",
  "description": "Employee directory and contract management — source of truth for workforce data",
  "endpoints": [
    {
      "id": "api-upsert-absence-config",
      "path": "/absence-configs",
      "method": "POST",
      "description": "Upsert absence configuration",
      "useCase": "Used by calling services to upsert absence configuration",
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
          "name": "svcEmployees-{env}"
        },
        {
          "type": "mongodb",
          "name": "svc-employees"
        },
        {
          "type": "kinesis",
          "name": "svc-employees-stream"
        }
      ]
    },
    {
      "id": "api-upsert-annualization-config",
      "path": "/annualization-configs",
      "method": "POST",
      "description": "Upsert annualization configuration",
      "useCase": "Used by calling services to upsert annualization configuration",
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
          "name": "svcEmployees-{env}"
        },
        {
          "type": "mongodb",
          "name": "svc-employees"
        },
        {
          "type": "kinesis",
          "name": "svc-employees-stream"
        }
      ]
    },
    {
      "id": "api-get-employee",
      "path": "/v1/employees",
      "method": "GET",
      "description": "Get employee by ID",
      "useCase": "Used by calling services to get employee by ID",
      "params": [
        {
          "name": "employeeId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "employeeId identifier"
        }
      ],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcEmployees-{env}"
        },
        {
          "type": "mongodb",
          "name": "svc-employees"
        }
      ]
    },
    {
      "id": "api-create-employee",
      "path": "/employees",
      "method": "POST",
      "description": "Create employee",
      "useCase": "Used by calling services to create employee",
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
          "name": "svcEmployees-{env}"
        },
        {
          "type": "mongodb",
          "name": "svc-employees"
        },
        {
          "type": "kinesis",
          "name": "svc-employees-stream"
        }
      ]
    },
    {
      "id": "api-public-swagger-docs",
      "path": "/public/swagger-docs.json",
      "method": "GET",
      "description": "GET /public/swagger-docs.json",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-absence-config-bulk-create",
      "path": "/v1/absence-configs/bulk_create",
      "method": "POST",
      "description": "Bulk create AbsenceConfig",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-absence-config-bulk-delete",
      "path": "/v1/absence-configs/{shopId}/{absenceType}",
      "method": "DELETE",
      "description": "Bulk delete AbsenceConfig",
      "useCase": "",
      "params": [
        {
          "name": "shopId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        },
        {
          "name": "absenceType",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-absence-config-get-all",
      "path": "/v1/absence-configs/{shopId}/{absenceType}",
      "method": "GET",
      "description": "Get All Employees AbsenceConfig by shopdId and absenceType",
      "useCase": "",
      "params": [
        {
          "name": "shopId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        },
        {
          "name": "absenceType",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-absence-config-get-one",
      "path": "/v1/absence-configs/{shopId}/{absenceType}/{userId}",
      "method": "GET",
      "description": "Get One Employee AbsenceConfig by shopdId, userId and absenceType",
      "useCase": "",
      "params": [
        {
          "name": "shopId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        },
        {
          "name": "absenceType",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        },
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
      "id": "api-absence-config-update",
      "path": "/v1/absence-configs/{shopId}/{absenceType}/{userId}",
      "method": "PATCH",
      "description": "Updates UserAbsenceConfig by shopId, userId and absenceType",
      "useCase": "",
      "params": [
        {
          "name": "shopId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        },
        {
          "name": "absenceType",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        },
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
      "id": "api-annualization-config-bulk-create",
      "path": "/v1/annualization-configs/bulk_create",
      "method": "POST",
      "description": "Bulk create AnnualizationConfig",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-annualization-config-bulk-delete",
      "path": "/v1/annualization-configs/{shopId}",
      "method": "DELETE",
      "description": "Bulk delete AnnualizationConfig",
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
      "id": "api-annualization-config-bulk-update",
      "path": "/v1/annualization-configs/{shopId}",
      "method": "PATCH",
      "description": "Bulk update AnnualizationConfig",
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
      "id": "api-annualization-config-get-all",
      "path": "/v1/annualization-configs/{shopId}",
      "method": "GET",
      "description": "Get All Employees AnnualizationConfig by shopdId",
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
      "id": "api-annualization-config-get-one",
      "path": "/v1/annualization-configs/{shopId}/{userId}",
      "method": "GET",
      "description": "Get One Employee AnnualizationConfig by shopdId and userId",
      "useCase": "",
      "params": [
        {
          "name": "shopId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        },
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
      "id": "api-annualization-config-update",
      "path": "/v1/annualization-configs/{shopId}/{userId}",
      "method": "PATCH",
      "description": "Update Employee AnnualizationConfig",
      "useCase": "",
      "params": [
        {
          "name": "shopId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        },
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
      "id": "api-annualization-config-upsert",
      "path": "/v1/annualization-configs/{shopId}/{userId}",
      "method": "PUT",
      "description": "Upsert Employee AnnualizationConfig",
      "useCase": "",
      "params": [
        {
          "name": "shopId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        },
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
      "id": "api-annualization-config-delete",
      "path": "/v1/annualization-configs/{shopId}/{userId}",
      "method": "DELETE",
      "description": "Delete Employee AnnualizationConfig",
      "useCase": "",
      "params": [
        {
          "name": "shopId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        },
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
      "id": "api-dpae-create",
      "path": "/v1/dpae-deposits/shops/{shopId}/employees/{employeeId}/contracts/{contractId}",
      "method": "POST",
      "description": "Create a DPAE deposit on Urssaf",
      "useCase": "",
      "params": [
        {
          "name": "shopId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        },
        {
          "name": "employeeId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        },
        {
          "name": "contractId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-get-active-contracts",
      "path": "/v1/employees/active-contracts",
      "method": "POST",
      "description": "Get active contracts for an array of employees each at a specific date",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-get-employees-by-organisation",
      "path": "/v1/employees/organisation",
      "method": "GET",
      "description": "Get all employees by organisation ID",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-upsert-employee",
      "path": "/v1/employees/{id}",
      "method": "PUT",
      "description": "Upsert an employee",
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
      "id": "api-compute-annualization-v2",
      "path": "/compute-annualization",
      "method": "POST",
      "description": "Compute annualization data",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-query-document-variables-for-employees-lambda",
      "path": "/v1/employees/document-variables",
      "method": "POST",
      "description": "Query document-generation variables for one or more employees",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-dpae-get-lambda",
      "path": "/v1/dpae-deposits/shops/{shopId}/employees/{employeeId}/contracts/{contractId}",
      "method": "GET",
      "description": "Get the last DPAE deposit for a contract",
      "useCase": "",
      "params": [
        {
          "name": "shopId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        },
        {
          "name": "employeeId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        },
        {
          "name": "contractId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-get-sst-codes",
      "path": "/v1/sst-codes",
      "method": "GET",
      "description": "Get SST codes from S3",
      "useCase": "",
      "params": [],
      "response": {}
    }
  ],
  "databases": [
    {
      "type": "dynamodb",
      "name": "svcEmployees-{env}",
      "description": "Employee profiles and absence configs"
    },
    {
      "type": "mongodb",
      "name": "svc-employees",
      "description": "Legacy employee data store (migration in progress)"
    },
    {
      "type": "sqs",
      "name": "svc-employees-dlq",
      "description": "Dead-letter queue for failed employee events"
    },
    {
      "type": "kinesis",
      "name": "svc-employees-stream",
      "description": "Employee change event stream for downstream consumers"
    }
  ]
})

export default svc_employees
