import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_employees: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-employees",
  "type": "typescript-microservice",
  "description": "Employee directory and contract management — source of truth for workforce data",
  "endpoints": [
    {
      "id": "api-get-absence-configs",
      "path": "/absence-configs",
      "method": "GET",
      "description": "Get absence configurations",
      "useCase": "Used by calling services to get absence configurations",
      "params": [],
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
      "id": "api-get-annualization-configs",
      "path": "/annualization-configs",
      "method": "GET",
      "description": "Get annualization configurations",
      "useCase": "Used by calling services to get annualization configurations",
      "params": [],
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
      "id": "api-get-dpae-deposits",
      "path": "/dpae-deposits",
      "method": "GET",
      "description": "Get DPAE deposits",
      "useCase": "Used by calling services to get DPAE deposits",
      "params": [],
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
      "id": "api-create-dpae-deposit",
      "path": "/dpae-deposits",
      "method": "POST",
      "description": "Create DPAE deposit",
      "useCase": "Used by calling services to create DPAE deposit",
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
      "path": "/employees/{employeeId}",
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
      "id": "api-get-employees",
      "path": "/employees",
      "method": "GET",
      "description": "Get employees",
      "useCase": "Used by calling services to get employees",
      "params": [],
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
      "id": "api-update-employee",
      "path": "/employees/{employeeId}",
      "method": "PATCH",
      "description": "Update employee",
      "useCase": "Used by calling services to update employee",
      "params": [
        {
          "name": "employeeId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "employeeId identifier"
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
      "id": "api-delete-employee",
      "path": "/employees/{employeeId}",
      "method": "DELETE",
      "description": "Delete employee",
      "useCase": "Used by calling services to delete employee",
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
        "204": "Deleted",
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
        },
        {
          "type": "kinesis",
          "name": "svc-employees-stream"
        }
      ]
    },
    {
      "id": "api-get-employee-contracts",
      "path": "/employees/{employeeId}/contracts",
      "method": "GET",
      "description": "Get employee contracts",
      "useCase": "Used by calling services to get employee contracts",
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
      "id": "api-create-employee-contract",
      "path": "/employees/{employeeId}/contracts",
      "method": "POST",
      "description": "Create employee contract",
      "useCase": "Used by calling services to create employee contract",
      "params": [
        {
          "name": "employeeId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "employeeId identifier"
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
      "id": "api-update-employee-contract",
      "path": "/employees/{employeeId}/contracts/{contractId}",
      "method": "PATCH",
      "description": "Update employee contract",
      "useCase": "Used by calling services to update employee contract",
      "params": [
        {
          "name": "employeeId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "employeeId identifier"
        },
        {
          "name": "contractId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "contractId identifier"
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
      "id": "api-delete-employee-contract",
      "path": "/employees/{employeeId}/contracts/{contractId}",
      "method": "DELETE",
      "description": "Delete employee contract",
      "useCase": "Used by calling services to delete employee contract",
      "params": [
        {
          "name": "employeeId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "employeeId identifier"
        },
        {
          "name": "contractId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "contractId identifier"
        }
      ],
      "response": {
        "204": "Deleted",
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
        },
        {
          "type": "kinesis",
          "name": "svc-employees-stream"
        }
      ]
    },
    {
      "id": "api-get-employee-counters",
      "path": "/employees/{employeeId}/counters",
      "method": "GET",
      "description": "Get employee counters",
      "useCase": "Used by calling services to get employee counters",
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
      "id": "api-upsert-employee-counter",
      "path": "/employees/{employeeId}/counters",
      "method": "POST",
      "description": "Upsert employee counter",
      "useCase": "Used by calling services to upsert employee counter",
      "params": [
        {
          "name": "employeeId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "employeeId identifier"
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
      "id": "api-bulk-upsert-employees",
      "path": "/employees/bulk",
      "method": "POST",
      "description": "Bulk upsert employees",
      "useCase": "Used by calling services to bulk upsert employees",
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
      "id": "api-get-shop-employee-attributes",
      "path": "/shops/{shopId}/employee-attributes",
      "method": "GET",
      "description": "Get shop employee attributes",
      "useCase": "Used by calling services to get shop employee attributes",
      "params": [
        {
          "name": "shopId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "shopId identifier"
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
      "id": "api-upsert-shop-employee-attributes",
      "path": "/shops/{shopId}/employee-attributes",
      "method": "POST",
      "description": "Upsert shop employee attributes",
      "useCase": "Used by calling services to upsert shop employee attributes",
      "params": [
        {
          "name": "shopId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "shopId identifier"
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
      "id": "api-get-time-off-counters",
      "path": "/time-off-counters",
      "method": "GET",
      "description": "Get time off counters",
      "useCase": "Used by calling services to get time off counters",
      "params": [],
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
      "id": "api-upsert-time-off-counters",
      "path": "/time-off-counters",
      "method": "POST",
      "description": "Upsert time off counters",
      "useCase": "Used by calling services to upsert time off counters",
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
      "id": "api-get-working-time-configs",
      "path": "/working-time-configs",
      "method": "GET",
      "description": "Get working time configurations",
      "useCase": "Used by calling services to get working time configurations",
      "params": [],
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
      "id": "api-upsert-working-time-config",
      "path": "/working-time-configs",
      "method": "POST",
      "description": "Upsert working time configuration",
      "useCase": "Used by calling services to upsert working time configuration",
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
