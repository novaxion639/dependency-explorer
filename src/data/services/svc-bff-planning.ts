import { ConnectivityServiceSchema } from '../schemas'
import type { ConnectivityService } from '../schemas'

const svc_bff_planning: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-bff-planning",
  "type": "typescript-microservice",
  "description": "Planning BFF — assembles shift scheduling data with employee context for the planning page",
  "endpoints": [
    {
      "id": "api-get-planning",
      "path": "/planning",
      "method": "GET",
      "description": "Assemble and return the full planning page payload",
      "useCase": "Called by skello-app-front to load all planning data in a single request",
      "params": [
        {
          "name": "shopId",
          "in": "query",
          "type": "string",
          "required": true,
          "description": "Target shop ID"
        },
        {
          "name": "weekStart",
          "in": "query",
          "type": "string",
          "required": true,
          "description": "ISO date of the week start"
        }
      ],
      "response": {
        "200": "Planning payload",
        "400": "Validation error",
        "503": "Upstream dependency unavailable"
      },
      "awsCalls": [
        {
          "type": "mongodb",
          "name": "svc-bff-planning"
        }
      ]
    },
    {
      "id": "api-compute-auto-scheduling",
      "path": "/auto_scheduling/compute",
      "method": "GET",
      "description": "Compute auto scheduling data for planning BFF",
      "useCase": "Used by calling services to compute auto scheduling data for planning BFF",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "mongodb",
          "name": "svc-bff-planning"
        }
      ]
    }
  ],
  "databases": [
    {
      "type": "mongodb",
      "name": "svc-bff-planning",
      "description": "Planning BFF cache and auto-scheduling request state"
    }
  ]
})

export default svc_bff_planning
