import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_reports: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-reports",
  "type": "typescript-microservice",
  "description": "Async report generation — exports timesheets, payroll summaries and compliance reports",
  "endpoints": [
    {
      "id": "api-get-pam-configs",
      "path": "/pam-configs",
      "method": "GET",
      "description": "Get PAM configurations",
      "useCase": "Used by calling services to get PAM configurations",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcReports-{env}"
        }
      ]
    },
    {
      "id": "api-create-pam-config",
      "path": "/pam-configs",
      "method": "POST",
      "description": "Create PAM configuration",
      "useCase": "Used by calling services to create PAM configuration",
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
          "name": "svcReports-{env}"
        }
      ]
    },
    {
      "id": "api-update-pam-config",
      "path": "/v1/pam-configs/{id}",
      "method": "PUT",
      "description": "Update PAM configuration",
      "useCase": "Used by calling services to update PAM configuration",
      "params": [
        {
          "name": "configId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "configId identifier"
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
          "name": "svcReports-{env}"
        }
      ]
    },
    {
      "id": "api-delete-pam-config",
      "path": "/pam-configs/{configId}",
      "method": "DELETE",
      "description": "Delete PAM configuration",
      "useCase": "Used by calling services to delete PAM configuration",
      "params": [
        {
          "name": "configId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "configId identifier"
        }
      ],
      "response": {
        "204": "Deleted",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcReports-{env}"
        }
      ]
    },
    {
      "id": "api-get-variable-pay-elements-custom",
      "path": "/variable-pay-elements/custom",
      "method": "GET",
      "description": "Get custom variable pay elements",
      "useCase": "Used by calling services to get custom variable pay elements",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcReports-{env}"
        }
      ]
    },
    {
      "id": "api-create-variable-pay-element-custom",
      "path": "/variable-pay-elements/custom",
      "method": "POST",
      "description": "Create custom variable pay element",
      "useCase": "Used by calling services to create custom variable pay element",
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
          "name": "svcReports-{env}"
        }
      ]
    },
    {
      "id": "api-delete-variable-pay-element-custom",
      "path": "/variable-pay-elements/custom/{elementId}",
      "method": "DELETE",
      "description": "Delete custom variable pay element",
      "useCase": "Used by calling services to delete custom variable pay element",
      "params": [
        {
          "name": "elementId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "elementId identifier"
        }
      ],
      "response": {
        "204": "Deleted",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcReports-{env}"
        }
      ]
    },
    {
      "id": "api-create-payroll-software",
      "path": "/v1/payroll-software",
      "method": "POST",
      "description": "Create payroll software",
      "useCase": "Used by calling services to create payroll software",
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
          "name": "svcReports-{env}"
        }
      ]
    },
    {
      "id": "api-update-payroll-software",
      "path": "/v1/payroll-software/{id}",
      "method": "PUT",
      "description": "Update payroll software",
      "useCase": "Used by calling services to update payroll software",
      "params": [
        {
          "name": "softwareId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "softwareId identifier"
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
          "name": "svcReports-{env}"
        }
      ]
    },
    {
      "id": "api-delete-payroll-software",
      "path": "/v1/payroll-software/{id}",
      "method": "DELETE",
      "description": "Delete payroll software",
      "useCase": "Used by calling services to delete payroll software",
      "params": [
        {
          "name": "softwareId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "softwareId identifier"
        }
      ],
      "response": {
        "204": "Deleted",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcReports-{env}"
        }
      ]
    },
    {
      "id": "api-find-one-pam-config",
      "path": "/v1/pam-configs/{id}",
      "method": "GET",
      "description": "Find a PAM config",
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
      "id": "api-assign-shops-to-pam-config",
      "path": "/v1/pam-configs/{id}/enabled-shops",
      "method": "PATCH",
      "description": "Assign shops to a PAM config",
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
      "id": "api-update-schedule-in-pam-config",
      "path": "/v1/pam-configs/{id}/schedule",
      "method": "PATCH",
      "description": "Update schedule in PAM Config",
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
      "id": "api-delete-schedule-in-pam-config",
      "path": "/v1/pam-configs/{id}/schedule",
      "method": "DELETE",
      "description": "Delete schedule in PAM Config",
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
      "id": "api-find-one-variable-pay-elements-custom",
      "path": "/v1/variable-pay-elements/custom/{id}",
      "method": "GET",
      "description": "Find a variable pay elements custom",
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
      "id": "api-update-variable-pay-elements-custom",
      "path": "/v1/variable-pay-elements/custom/{id}",
      "method": "PUT",
      "description": "Update a variable pay elements custome",
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
      "id": "api-find-all-payroll-sofware",
      "path": "/v1/payroll-software",
      "method": "GET",
      "description": "Get all payroll software",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-find-one-payroll-software",
      "path": "/v1/payroll-software/{id}",
      "method": "GET",
      "description": "Find a payroll software",
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
    }
  ],
  "databases": [
    {
      "type": "dynamodb",
      "name": "svcReports-{env}",
      "description": "PAM configs, payroll software mappings and report jobs"
    }
  ]
})

export default svc_reports
