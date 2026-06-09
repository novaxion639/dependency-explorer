import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_trackers: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-trackers",
  "type": "typescript-microservice",
  "description": "Time tracker — project and task-based time logging across the workforce",
  "endpoints": [
    {
      "id": "api-initialize-tracker",
      "path": "/v1/shops/{shopId}/shop-settings/activation",
      "method": "POST",
      "description": "Create settings for shop + employee and trackers",
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
      "id": "api-list-shop-settings",
      "path": "/v1/shops/{shopId}/shop-settings",
      "method": "GET",
      "description": "Get all shop settings for a given shop",
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
      "id": "api-deactivate-tracker",
      "path": "/v1/shops/{shopId}/shop-settings/{key}/deactivation",
      "method": "DELETE",
      "description": "Deactivates a tracker for a given shop",
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
          "name": "key",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-initialize-employee-tracker",
      "path": "/v1/shops/{shopId}/employees/{employeeId}/employee-settings/activation",
      "method": "POST",
      "description": "Create setting for single employee and related tracker",
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
        }
      ],
      "response": {}
    },
    {
      "id": "api-get-employee-setting",
      "path": "/v1/shops/{shopId}/employees/{employeeId}/employee-settings/{key}",
      "method": "GET",
      "description": "Get employee setting for given employee, shop and key",
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
          "name": "key",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-deactivate-employee-tracker",
      "path": "/v1/shops/{shopId}/employees/{employeeId}/employee-settings/{key}/deactivation",
      "method": "DELETE",
      "description": "Deactivates a tracker for a given employee",
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
          "name": "key",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-get-employee-trackers",
      "path": "/v1/shops/{shopId}/employees/{employeeId}/trackers/{key}",
      "method": "GET",
      "description": "Get trackers for a given employee, shop, key and period",
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
          "name": "key",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-upsert-manual-changes",
      "path": "/v1/shops/{shopId}/employees/{employeeId}/trackers/{key}/manual-changes",
      "method": "PATCH",
      "description": "Upsert manual changes for a given tracker",
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
          "name": "key",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-get-bulk-employee-trackers",
      "path": "/v1/shops/{shopId}/employees/trackers/bulk-fetch",
      "method": "POST",
      "description": "Get trackers for multiple employees in a shop for a given key and period",
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
      "id": "api-get-previsional-tracker",
      "path": "/v1/shops/{shopId}/employees/{employeeId}/trackers/{key}/previsional",
      "method": "GET",
      "description": "Get previsional tracker data for an employee",
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
          "name": "key",
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
      "name": "svc-trackers",
      "description": "Tracker settings and geofencing rules per shop"
    }
  ]
})

export default svc_trackers
