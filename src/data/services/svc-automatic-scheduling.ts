import { ConnectivityServiceSchema } from '../schemas'
import type { ConnectivityService } from '../schemas'

const svc_automatic_scheduling: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-automatic-scheduling",
  "type": "typescript-microservice",
  "description": "AI-powered automatic shift scheduling — generates optimal rotas based on constraints and forecasts",
  "endpoints": [
    {
      "id": "api-get-shift-replacements",
      "path": "/shift-replacements",
      "method": "POST",
      "description": "Get shift replacements candidates",
      "useCase": "Used by calling services to get shift replacements candidates",
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
          "name": "svc-automatic-scheduling"
        }
      ]
    },
    {
      "id": "api-trigger-auto-scheduling",
      "path": "/auto-scheduling/trigger",
      "method": "POST",
      "description": "Trigger auto scheduling computation",
      "useCase": "Used by calling services to trigger auto scheduling computation",
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
          "name": "svc-automatic-scheduling"
        }
      ]
    }
  ],
  "databases": [
    {
      "type": "mongodb",
      "name": "svc-automatic-scheduling",
      "description": "Optimisation results and shift generation history"
    }
  ]
})

export default svc_automatic_scheduling
