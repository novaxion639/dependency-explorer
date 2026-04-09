import { ConnectivityServiceSchema } from '../schemas'
import type { ConnectivityService } from '../schemas'

const svc_bff: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-bff",
  "type": "typescript-microservice",
  "description": "Backend-For-Frontend — aggregates data from multiple services into optimised frontend payloads",
  "endpoints": [
    {
      "id": "api-orchestrate-documents",
      "path": "/v1/documents",
      "method": "POST",
      "description": "BFF orchestration for documents",
      "useCase": "Used by calling services to bFF orchestration for documents",
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
          "name": "svcBff-{env}"
        }
      ]
    },
    {
      "id": "api-bulk-update-kpis",
      "path": "/v1/kpis",
      "method": "POST",
      "description": "BFF bulk update KPIs",
      "useCase": "Used by calling services to bFF bulk update KPIs",
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
          "name": "svcBff-{env}"
        }
      ]
    }
  ],
  "databases": [
    {
      "type": "dynamodb",
      "name": "svcBff-{env}",
      "description": "BFF request cache and orchestration state"
    }
  ]
})

export default svc_bff
