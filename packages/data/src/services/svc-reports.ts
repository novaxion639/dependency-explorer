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
      "path": "/pam-configs/{configId}",
      "method": "PATCH",
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
      "id": "api-update-variable-pay-element-custom",
      "path": "/variable-pay-elements/custom/{elementId}",
      "method": "PATCH",
      "description": "Update custom variable pay element",
      "useCase": "Used by calling services to update custom variable pay element",
      "params": [
        {
          "name": "elementId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "elementId identifier"
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
      "id": "api-get-payroll-softwares",
      "path": "/payroll-softwares",
      "method": "GET",
      "description": "Get payroll softwares",
      "useCase": "Used by calling services to get payroll softwares",
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
      "id": "api-create-payroll-software",
      "path": "/payroll-softwares",
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
      "path": "/payroll-softwares/{softwareId}",
      "method": "PATCH",
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
      "path": "/payroll-softwares/{softwareId}",
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
      "id": "api-get-report-configs",
      "path": "/report-configs",
      "method": "GET",
      "description": "Get report configurations",
      "useCase": "Used by calling services to get report configurations",
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
      "id": "api-create-report-config",
      "path": "/report-configs",
      "method": "POST",
      "description": "Create report configuration",
      "useCase": "Used by calling services to create report configuration",
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
      "id": "api-update-report-config",
      "path": "/report-configs/{configId}",
      "method": "PATCH",
      "description": "Update report configuration",
      "useCase": "Used by calling services to update report configuration",
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
      "id": "api-delete-report-config",
      "path": "/report-configs/{configId}",
      "method": "DELETE",
      "description": "Delete report configuration",
      "useCase": "Used by calling services to delete report configuration",
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
      "id": "api-get-column-sets",
      "path": "/column-sets",
      "method": "GET",
      "description": "Get column sets",
      "useCase": "Used by calling services to get column sets",
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
      "id": "api-create-column-set",
      "path": "/column-sets",
      "method": "POST",
      "description": "Create column set",
      "useCase": "Used by calling services to create column set",
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
      "id": "api-update-column-set",
      "path": "/column-sets/{columnSetId}",
      "method": "PATCH",
      "description": "Update column set",
      "useCase": "Used by calling services to update column set",
      "params": [
        {
          "name": "columnSetId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "columnSetId identifier"
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
      "id": "api-delete-column-set",
      "path": "/column-sets/{columnSetId}",
      "method": "DELETE",
      "description": "Delete column set",
      "useCase": "Used by calling services to delete column set",
      "params": [
        {
          "name": "columnSetId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "columnSetId identifier"
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
      "id": "api-trigger-report-export",
      "path": "/reports",
      "method": "POST",
      "description": "Trigger an async planning report export job",
      "useCase": "Called by skello-app-front to start a report export for a selected period",
      "params": [
        {
          "name": "body",
          "in": "body",
          "type": "object",
          "required": true,
          "description": "Export configuration including period, shopId and format"
        }
      ],
      "response": {
        "202": "Job created — returns jobId",
        "400": "Validation error"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcReports-{env}"
        },
        {
          "type": "lambda",
          "name": "report-generator"
        }
      ]
    },
    {
      "id": "api-get-report-job",
      "path": "/reports/{jobId}",
      "method": "GET",
      "description": "Poll the status of an async report export job",
      "useCase": "Called by skello-app-front to check if the report is ready; returns a pre-signed S3 URL on completion",
      "params": [
        {
          "name": "jobId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "Report job ID returned by POST /reports"
        }
      ],
      "response": {
        "200": "Job status and optional signedUrl",
        "404": "Job not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcReports-{env}"
        },
        {
          "type": "s3",
          "name": "skello-reports-{env}"
        }
      ]
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
