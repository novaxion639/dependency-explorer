import { ConnectivityServiceSchema } from '../schemas'
import type { ConnectivityService } from '../schemas'

const svc_automatic_scheduling: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-automatic-scheduling",
  "type": "typescript-microservice",
  "description": "AI-powered automatic shift scheduling — orchestrates a Step Functions pipeline of 13 Lambdas (Node.js + Python CP-SAT solver) to generate and write optimised rotas. Also exposes a synchronous shift-replacement candidate ranking endpoint.",
  "endpoints": [
    {
      "id": "api-get-shift-replacements",
      "path": "/shifts/{shiftId}/employee_replacements",
      "method": "GET",
      "description": "Return ranked replacement candidates for an uncovered shift",
      "useCase": "Called by the frontend to surface available employees when a shift needs a replacement",
      "params": [
        {
          "name": "shiftId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "ID of the shift needing a replacement"
        }
      ],
      "response": {
        "200": "Ranked list of replacement candidates",
        "404": "Shift not found"
      },
      "awsCalls": [
        {
          "type": "mongodb",
          "name": "svc-search DB"
        }
      ]
    },
    {
      "id": "api-trigger-auto-scheduling",
      "path": "/auto_scheduling/compute",
      "method": "POST",
      "description": "Start an auto-scheduling Step Functions execution for a shop and week",
      "useCase": "Triggered by the frontend to launch the full SFN pipeline; returns immediately while the pipeline runs asynchronously",
      "params": [
        {
          "name": "body",
          "in": "body",
          "type": "object",
          "required": true,
          "description": "shopId, weekStart, and scheduling constraints"
        }
      ],
      "response": {
        "200": "Execution started (jobId returned)",
        "400": "Validation error"
      },
      "awsCalls": [
        {
          "type": "lambda",
          "name": "AutoScheduling-StepFunction"
        }
      ]
    }
  ],
  "databases": [
    {
      "type": "mongodb",
      "name": "automatic_scheduling_jobs",
      "description": "Tracks auto-scheduling job lifecycle (status, input params, error details)"
    },
    {
      "type": "lambda",
      "name": "AutoScheduling Step Function (7 steps)",
      "description": "STANDARD Step Functions state machine — dataFetcher → eligibility (parallel batches) → aggregate → solver → assignShifts → finishJob → errorHandler"
    },
    {
      "type": "lambda",
      "name": "svcAutomaticScheduling-solver (Python 3.14)",
      "description": "OR-Tools CP-SAT constraint programming optimizer — 10 GB RAM, 15 min timeout. Generates optimal shift assignments from the aggregated eligibility payload."
    },
    {
      "type": "s3",
      "name": "svc-automatic-scheduling-sfn-ctx",
      "description": "Stores Step Function execution context JSON between steps (written by dataFetcher, read by eligibility / aggregate / solver / assignShifts)"
    },
    {
      "type": "sqs",
      "name": "svcAutomaticScheduling-autoAssignMetrics",
      "description": "Receives job-completion metrics events from the finishJob SFN step; consumed by handleAutoAssignMetrics Lambda"
    },
    {
      "type": "sqs",
      "name": "svcAutomaticScheduling-shiftsEmployeeReplacementsMetrics",
      "description": "Receives replacement-search metrics events; consumed by handleSuggestionsMetrics Lambda"
    }
  ]
})

export default svc_automatic_scheduling
