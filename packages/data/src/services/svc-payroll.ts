import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_payroll: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-payroll",
  "type": "typescript-microservice",
  "description": "Payroll provider integration — maps Skello organisations to payroll-software companies (per provider), triggers and tracks payroll data synchronisation, and serves EVPs (éléments variables de paie / variable pay elements)",
  "endpoints": [
    {
      "id": "api-companies-list",
      "path": "/v1/providers/{providerKey}/companies",
      "method": "GET",
      "description": "List companies for the connected payroll provider",
      "useCase": "",
      "params": [
        {
          "name": "providerKey",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-company-mapping-upsert",
      "path": "/v1/providers/{providerKey}/company-mapping",
      "method": "POST",
      "description": "Upsert the company mapping for the connected payroll provider",
      "useCase": "",
      "params": [
        {
          "name": "providerKey",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-company-mapping-get",
      "path": "/v1/providers/{providerKey}/company-mapping",
      "method": "GET",
      "description": "Get the connected company (a3CompanyCode) for the payroll provider",
      "useCase": "",
      "params": [
        {
          "name": "providerKey",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-sync-trigger",
      "path": "/v1/sync/trigger",
      "method": "POST",
      "description": "Trigger a new payroll sync run for a shop and period",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-sync-status",
      "path": "/v1/sync/status",
      "method": "GET",
      "description": "Returns whether a new sync can be triggered for the shop and details of any active sync run",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-evps-list",
      "path": "/v1/evps",
      "method": "GET",
      "description": "List the org-level unique EVP catalog",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-evps-list-mapped",
      "path": "/v1/evps/mapped",
      "method": "GET",
      "description": "List the mapped EVP rows from TEMPLATE_MAPPING for the requested provider",
      "useCase": "",
      "params": [],
      "response": {}
    }
  ],
  "databases": [
    {
      "type": "dynamodb",
      "name": "svcPayroll-{env}",
      "description": "Provider/company mappings and payroll sync state"
    }
  ]
})

export default svc_payroll
