import { ConnectivityServiceSchema } from '../schemas'
import type { ConnectivityService } from '../schemas'

const svc_bff_planning: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-bff-planning",
  "type": "typescript-microservice",
  "description": "Standalone auto-scheduling engine — fetches planning context from skello-app, runs CP-SAT eligibility computation across 13 rule classes, and invokes a co-deployed Python OR-Tools solver Lambda. Not deployed on sandbox (decommissioned there in favour of svc-automatic-scheduling).",
  "endpoints": [
    {
      "id": "api-compute-auto-scheduling",
      "path": "/auto_scheduling/compute",
      "method": "GET",
      "description": "Run the full eligibility + OR-Tools CP-SAT scheduling computation for a shop and week",
      "useCase": "Invoked to generate an optimised shift roster; invokes svcBffPlanning-solver Lambda synchronously",
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
        "200": "Optimised shift assignments",
        "400": "Validation error"
      },
      "awsCalls": [
        {
          "type": "lambda",
          "name": "svcBffPlanning-solver"
        }
      ]
    }
  ],
  "databases": [
    {
      "type": "lambda",
      "name": "svcBffPlanning-solver",
      "description": "Python 3.13 OR-Tools CP-SAT solver Lambda — invoked synchronously (RequestResponse) with the eligibility payload; 10 GB RAM, 900 s timeout"
    },
    {
      "type": "mongodb",
      "name": "svc-search DB (direct read)",
      "description": "Reads shifts and postes directly from svc-search's MongoDB over VPC (no HTTP — ShiftRepository + PosteRepository collections)"
    }
  ]
})

export default svc_bff_planning
