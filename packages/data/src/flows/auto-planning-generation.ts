import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

const auto_planning_generation: ServiceFlow = ServiceFlowSchema.parse({
  "id": "auto-planning-generation",
  "name": "AI Auto-Planning Generation",
  "description": "Triggered by the frontend via POST /automatic_assignment/compute, which returns a websocketId for live progress tracking. svc-automatic-scheduling creates a job in MongoDB (STARTED) and starts an AWS Step Functions pipeline. Each Lambda step updates the job status in MongoDB and sends a progress notification to websocket-topicMessage SQS (except the Python solver, which has no TS notification access — the aggregate step pre-sends SOLVING on its behalf). Context (shifts, postes, users, shop) travels through the SFN context S3 bucket (svc-automatic-scheduling.assignment): the data fetcher writes it, each eligibility batch reads it and writes its result, the aggregate step reads both and writes the solver payload, the solver writes the assignments and assignShifts reads them back; the SFN state carries the object keys (contextKey, solverPayloadKey, assignmentPayloadKey).",
  "trigger": {"actor": "manager", "role": "planner"},
  "primaryArea": "automatic-scheduling",
  "chapters": [
    { "title": "A planner starts auto-scheduling", "summary": "The front asks svc-automatic-scheduling to compute; it records a started job and returns a websocket id for live progress.", "refs": ["svc-automatic-scheduling", "mongo-jobs-trigger"] },
    { "title": "The pipeline starts fetching", "summary": "The first pipeline step sets the job to data fetching and sends that status to the planner's websocket channel.", "refs": ["sfn-dataFetcher", "mongo-jobs-dataFetcher", "sqs-ws-dataFetcher"] },
    { "title": "Shop and staff come from skello-app", "summary": "It reads shop, teams, postes and contract types, then users, contracts, memberships and licenses from skello-app.", "refs": ["sfn-dataFetcher", "skello-app (data)", "pg-skello-read"] },
    { "title": "Shifts come from svc-search", "summary": "Assigned and unassigned shifts and postes are read straight from svc-search's MongoDB; the assembled context is written to the S3 context bucket.", "refs": ["sfn-dataFetcher", "mongo-svc-search", "s3-ctx-dataFetcher"] },
    { "title": "Eligibility is checked in batches", "summary": "Employee batches are checked in parallel; each reads the context from S3, writes its result back there, and sends a progress message.", "refs": ["sfn-eligibility", "mongo-jobs-eligibility", "sqs-ws-eligibility", "s3-ctx-eligibility"] },
    { "title": "Results are combined and solved", "summary": "Batch results are aggregated and the solving status pre-sent; the Python solver reads its payload from S3 and writes the assignments back there.", "refs": ["sfn-aggregate", "mongo-jobs-aggregate", "sqs-ws-aggregate", "s3-ctx-aggregate", "cu-as-solver", "s3-ctx-solver"] },
    { "title": "The result goes back to skello-app", "summary": "The assign step sets the job to assigning, tells the planner, and calls skello-app's private write-back with an API key.", "refs": ["sfn-assignShifts", "mongo-jobs-assignShifts", "sqs-ws-assignShifts", "s3-ctx-assignShifts", "svc-automatic-scheduling", "cu-as-controller"] },
    { "title": "Assignments are saved", "summary": "skello-app persists the optimised user-to-shift assignments, writing shifts, badgings and swaps in one transaction.", "refs": ["cu-as-controller", "cu-as-assignment", "cu-as-save", "skello-app (assign)", "pg-skello-write"] },
    { "title": "Generated shifts are created", "summary": "In automatic shift creation mode, the write-back bulk-inserts the generated shifts.", "refs": ["cu-as-controller", "cu-as-bulk-create", "pg-skello-write"] },
    { "title": "Alerts and counters are refreshed", "summary": "Alerts are recomputed for the touched shifts, and planning-hours, RCR and paid-leave counters are recalculated.", "refs": ["cu-as-assignment", "cu-as-alert", "cu-as-tracker-v2"] },
    { "title": "Weekly options are marked stale", "summary": "A background job is queued for each affected employee and week to mark its weekly options stale.", "refs": ["cu-as-assignment", "cu-as-cb-job"] },
    { "title": "The planner sees the result", "summary": "The job is marked finished, the final progress message arrives and the planning shows the optimised roster.", "refs": ["sfn-finishJob", "mongo-jobs-finishJob", "sqs-ws-finishJob"] }
  ],
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-automatic-scheduling",
      "action": "Trigger auto-scheduling — POST /automatic_assignment/compute → { websocketId }"
    },
    {
      "from": "svc-automatic-scheduling",
      "to": "skello-app-front",
      "action": "HTTP 200 {websocketId} — frontend opens WebSocket channel for live SFN progress"
    },
    {
      "from": "svc-automatic-scheduling",
      "to": "sfn-dataFetcher",
      "action": "SFN step 1 — fetch planning context from skello-app + read shifts/postes from svc-search MongoDB"
    },
    {
      "from": "sfn-dataFetcher",
      "to": "skello-app (data)",
      "action": "GET private/svc_shops/shops/:id — shop, teams, postes, contract_types (from PostgreSQL)"
    },
    {
      "from": "sfn-dataFetcher",
      "to": "skello-app (data)",
      "action": "GET /v3/api/automatic_scheduling/users — users, contracts, memberships, teams, licenses (from PostgreSQL)"
    },
    {
      "from": "sfn-dataFetcher",
      "to": "sfn-eligibility",
      "action": "SFN step 2 — parallel Map: compute eligibility for each employee batch (pure in-memory)"
    },
    {
      "from": "sfn-eligibility",
      "to": "sfn-aggregate",
      "action": "SFN step 3 — aggregate eligibility results from all batches"
    },
    {
      "from": "sfn-aggregate",
      "to": "sfn-solver",
      "action": "SFN step 4 — Python CP-SAT optimizer (10 GB RAM, 15 min timeout; reads solver-payload.json, writes assignment-payload.json in the SFN context S3 bucket)"
    },
    {
      "from": "sfn-solver",
      "to": "sfn-assignShifts",
      "action": "SFN step 5 — write optimised shift assignments to skello-app"
    },
    {
      "from": "sfn-assignShifts",
      "to": "skello-app (assign)",
      "action": "PATCH /v3/api/plannings/shifts — update shifts, badgings, shift_swaps in PostgreSQL"
    },
    {
      "from": "sfn-assignShifts",
      "to": "sfn-finishJob",
      "action": "SFN step 6 — mark FINISHED, send final WebSocket notification"
    },
    {
      "from": "skello-app (assign)",
      "to": "skello-app-front (notify)",
      "action": "Planning updated — Vue2 app displays optimised roster"
    }
  ],
    "codeUnits": [
      {
        "id": "cu-as-controller",
        "service": "skello-app",
        "kind": "controller",
        "label": "V3::Api::AutomaticScheduling::ShiftsController",
        "path": "app/controllers/v3/api/automatic_scheduling/shifts_controller.rb",
        "description": "Private write-back surface called by the SFN: #update applies optimised assignments to existing shifts, #create bulk-creates generated shifts"
      },
      {
        "id": "cu-as-assignment",
        "service": "skello-app",
        "kind": "service",
        "label": "V3::Shifts::AutomaticAssignmentService",
        "path": "app/services/v3/shifts/automatic_assignment_service.rb",
        "description": "Applies the optimiser result: persists assignments, recomputes alerts and counters (V2 variant), refreshes the first-shift cache store, enqueues weekly-option staleness"
      },
      {
        "id": "cu-as-save",
        "service": "skello-app",
        "kind": "service",
        "label": "V3::Shifts::AutomaticAssignmentSaveService",
        "path": "app/services/v3/shifts/automatic_assignment_save_service.rb",
        "description": "Persists the optimised user→shift assignments"
      },
      {
        "id": "cu-as-alert",
        "service": "skello-app",
        "kind": "service",
        "label": "V3::Shifts::AutomaticAssignmentAlertService",
        "path": "app/services/v3/shifts/automatic_assignment_alert_service.rb",
        "description": "Recomputes assignment alerts for the touched shifts"
      },
      {
        "id": "cu-as-bulk-create",
        "service": "skello-app",
        "kind": "service",
        "label": "V3::Shifts::AutomaticSchedulingBulkCreateService",
        "path": "app/services/v3/shifts/automatic_scheduling_bulk_create_service.rb",
        "description": "Bulk Shift.new/insert for generated shifts (Automatic Shift Creation mode)"
      },
      {
        "id": "cu-as-tracker-v2",
        "service": "skello-app",
        "kind": "manager",
        "label": "V3::CombinedTrackerUpdateServiceV2",
        "path": "app/services/v3/combined_tracker_update_service_v2.rb",
        "description": "V2 counter recompute used by the auto-assignment path (PlanningHoursDatas, RCR, paid leaves)"
      },
      {
        "id": "cu-as-cb-job",
        "service": "skello-app",
        "kind": "job",
        "label": "ShiftCallbackJob",
        "path": "app/jobs/shift_callback_job.rb",
        "description": "Weekly-option staleness — enqueued directly by AutomaticAssignmentService per affected user/week"
      },
      {
        "id": "cu-as-solver",
        "service": "svc-automatic-scheduling",
        "kind": "job",
        "label": "lambda_handler",
        "path": "solver/handler.py",
        "description": "Python CP-SAT solver Lambda (JobSfnSolver, 10 GB, 15 min): loads the solver payload from the SFN context bucket, runs solve() (solver/src/solver.py), writes assignment-payload.json and folds solverMetrics into metrics.json; no HTTP, Mongo or SQS calls"
      }
    ],
    "codeEdges": [
      {
        "from": "svc-automatic-scheduling",
        "to": "cu-as-solver",
        "label": "SFN sfnSolver task — {input, solverPayloadKey}",
        "mode": "sync"
      },
      {
        "from": "cu-as-solver",
        "to": "s3-ctx-solver",
        "label": "solver payload in; assignments + solverMetrics out",
        "mode": "sync",
        "crud": [
          "read",
          "create",
          "update"
        ]
      },
      {
        "from": "svc-automatic-scheduling",
        "to": "cu-as-controller",
        "label": "SFN assignShifts write-back (private, API key)",
        "mode": "sync"
      },
      {
        "from": "cu-as-controller",
        "to": "cu-as-assignment",
        "label": "#update — apply optimised assignments",
        "mode": "sync"
      },
      {
        "from": "cu-as-controller",
        "to": "cu-as-bulk-create",
        "label": "#create — bulk create generated shifts",
        "mode": "sync",
        "condition": "Automatic Shift Creation mode"
      },
      {
        "from": "cu-as-assignment",
        "to": "cu-as-save",
        "label": "persist assignments",
        "mode": "sync"
      },
      {
        "from": "cu-as-assignment",
        "to": "cu-as-alert",
        "label": "recompute alerts",
        "mode": "sync"
      },
      {
        "from": "cu-as-assignment",
        "to": "cu-as-tracker-v2",
        "label": "recompute counters (V2)",
        "mode": "sync"
      },
      {
        "from": "cu-as-assignment",
        "to": "cu-as-cb-job",
        "label": "weekly-option staleness",
        "mode": "async-job"
      },
      {
        "from": "cu-as-save",
        "to": "pg-skello-write",
        "label": "assign users to shifts",
        "mode": "sync",
        "crud": [
          "update"
        ]
      },
      {
        "from": "cu-as-bulk-create",
        "to": "pg-skello-write",
        "label": "bulk shift rows",
        "mode": "sync",
        "crud": [
          "create"
        ]
      }
    ],
  "infraNodes": [
    {
      "id": "mongo-jobs-trigger",
      "type": "mongodb",
      "label": "automatic_assignment_jobs",
      "resources": ["mongo:svc-automatic-scheduling"],
      "description": "Create job record (status: STARTED, websocketId: UUID)"
    },
    {
      "id": "mongo-svc-search",
      "type": "mongodb",
      "label": "svc-search DB (direct VPC)",
      "resources": ["mongo:svc-search"],
      "description": "Direct MongoDB reads — shifts (unassigned + assigned) and rawPoste collections"
    },
    {
      "id": "mongo-jobs-dataFetcher",
      "type": "mongodb",
      "label": "automatic_assignment_jobs",
      "resources": ["mongo:svc-automatic-scheduling"],
      "description": "Update job status → DATA_FETCHING"
    },
    {
      "id": "sqs-ws-dataFetcher",
      "type": "sqs",
      "label": "websocket-topicMessage",
      "resources": ["sqs:websocket-topicMessage"],
      "description": "Send DATA_FETCHING notification to frontend WebSocket channel"
    },
    {
      "id": "s3-ctx-dataFetcher",
      "type": "s3",
      "label": "svc-automatic-scheduling.assignment",
      "resources": ["s3:svc-automatic-scheduling.assignment"],
      "description": "SFN context bucket — the data fetcher writes the context (jobs/{jobId}/rule-chain-payload.json: shifts, postes, users, shop), the initial metrics.json and an empty error-trace list"
    },
    {
      "id": "mongo-jobs-eligibility",
      "type": "mongodb",
      "label": "automatic_assignment_jobs",
      "resources": ["mongo:svc-automatic-scheduling"],
      "description": "Update job status → ELIGIBILITY_COMPLIANCE_CHECK"
    },
    {
      "id": "sqs-ws-eligibility",
      "type": "sqs",
      "label": "websocket-topicMessage",
      "resources": ["sqs:websocket-topicMessage"],
      "description": "Send ELIGIBILITY_COMPLIANCE_CHECK (once per batch invocation)"
    },
    {
      "id": "s3-ctx-eligibility",
      "type": "s3",
      "label": "svc-automatic-scheduling.assignment",
      "resources": ["s3:svc-automatic-scheduling.assignment"],
      "description": "SFN context bucket — each eligibility batch reads rule-chain-payload.json and writes rule-chain-batch-result-{index}.json"
    },
    {
      "id": "mongo-jobs-aggregate",
      "type": "mongodb",
      "label": "automatic_assignment_jobs",
      "resources": ["mongo:svc-automatic-scheduling"],
      "description": "Update job status → ELIGIBILITY_AGGREGATION"
    },
    {
      "id": "sqs-ws-aggregate",
      "type": "sqs",
      "label": "websocket-topicMessage",
      "resources": ["sqs:websocket-topicMessage"],
      "description": "Send ELIGIBILITY_AGGREGATION + SOLVING (pre-sent for Python solver)"
    },
    {
      "id": "s3-ctx-aggregate",
      "type": "s3",
      "label": "svc-automatic-scheduling.assignment",
      "resources": ["s3:svc-automatic-scheduling.assignment"],
      "description": "SFN context bucket — the aggregate step reads rule-chain-payload.json and every rule-chain-batch-result-{index}.json, writes solver-payload.json and updates metrics.json"
    },
    {
      "id": "s3-ctx-solver",
      "type": "s3",
      "label": "svc-automatic-scheduling.assignment",
      "resources": ["s3:svc-automatic-scheduling.assignment"],
      "description": "SFN context bucket — the solver reads jobs/{jobId}/solver-payload.json and metrics.json, writes assignment-payload.json and updates metrics.json (solverMetrics)"
    },
    {
      "id": "mongo-jobs-assignShifts",
      "type": "mongodb",
      "label": "automatic_assignment_jobs",
      "resources": ["mongo:svc-automatic-scheduling"],
      "description": "Update job status → ASSIGNING"
    },
    {
      "id": "sqs-ws-assignShifts",
      "type": "sqs",
      "label": "websocket-topicMessage",
      "resources": ["sqs:websocket-topicMessage"],
      "description": "Send ASSIGNING notification to frontend WebSocket channel"
    },
    {
      "id": "s3-ctx-assignShifts",
      "type": "s3",
      "label": "svc-automatic-scheduling.assignment",
      "resources": ["s3:svc-automatic-scheduling.assignment"],
      "description": "SFN context bucket — assignShifts reads the solver's assignment-payload.json and updates metrics.json"
    },
    {
      "id": "mongo-jobs-finishJob",
      "type": "mongodb",
      "label": "automatic_assignment_jobs",
      "resources": ["mongo:svc-automatic-scheduling"],
      "description": "Update job status → FINISHED"
    },
    {
      "id": "sqs-ws-finishJob",
      "type": "sqs",
      "label": "websocket-topicMessage",
      "resources": ["sqs:websocket-topicMessage"],
      "description": "Send FINISHED notification to frontend WebSocket channel"
    },
    {
      "id": "pg-skello-read",
      "type": "postgresql",
      "label": "skello_production (RDS)",
      "resources": ["pg:skello_production.shops", "pg:skello_production.teams", "pg:skello_production.postes", "pg:skello_production.contract_types", "pg:skello_production.users", "pg:skello_production.contracts", "pg:skello_production.memberships", "pg:skello_production.licenses", "pg:skello_production.contract_amendments"],
      "description": "Read shops, teams, postes, contract_types, users, contracts, memberships, licenses, amendments"
    },
    {
      "id": "pg-skello-write",
      "type": "postgresql",
      "label": "skello_production (RDS)",
      "resources": ["pg:skello_production.shifts", "pg:skello_production.badgings", "pg:skello_production.shift_swaps", "pg:skello_production.shift_replacements"],
      "description": "Write shifts, badgings, shift_swaps, shift_replacements in a transaction"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-automatic-scheduling",
      "to": "mongo-jobs-trigger",
      "label": "create job (STARTED)",
      "crud": ["create"]
    },
    {
      "from": "sfn-dataFetcher",
      "to": "mongo-svc-search",
      "label": "read shifts + postes",
      "crud": ["read"]
    },
    {
      "from": "sfn-dataFetcher",
      "to": "mongo-jobs-dataFetcher",
      "label": "update status",
      "crud": ["update"]
    },
    {
      "from": "sfn-dataFetcher",
      "to": "sqs-ws-dataFetcher",
      "label": "DATA_FETCHING",
      "crud": ["create"]
    },
    {
      "from": "sfn-dataFetcher",
      "to": "s3-ctx-dataFetcher",
      "label": "write context + metrics + error traces",
      "crud": ["create", "update"]
    },
    {
      "from": "sfn-eligibility",
      "to": "mongo-jobs-eligibility",
      "label": "update status",
      "crud": ["update"]
    },
    {
      "from": "sfn-eligibility",
      "to": "sqs-ws-eligibility",
      "label": "ELIGIBILITY_COMPLIANCE_CHECK",
      "crud": ["create"]
    },
    {
      "from": "sfn-eligibility",
      "to": "s3-ctx-eligibility",
      "label": "read context, write batch result",
      "crud": ["read", "create"]
    },
    {
      "from": "sfn-aggregate",
      "to": "mongo-jobs-aggregate",
      "label": "update status",
      "crud": ["update"]
    },
    {
      "from": "sfn-aggregate",
      "to": "sqs-ws-aggregate",
      "label": "ELIGIBILITY_AGGREGATION + SOLVING",
      "crud": ["create"]
    },
    {
      "from": "sfn-aggregate",
      "to": "s3-ctx-aggregate",
      "label": "read context + batch results, write solver payload + metrics",
      "crud": ["read", "create", "update"]
    },
    {
      "from": "sfn-solver",
      "to": "s3-ctx-solver",
      "label": "solver payload in, assignments + solverMetrics out",
      "crud": ["read", "create", "update"]
    },
    {
      "from": "sfn-assignShifts",
      "to": "mongo-jobs-assignShifts",
      "label": "update status",
      "crud": ["update"]
    },
    {
      "from": "sfn-assignShifts",
      "to": "sqs-ws-assignShifts",
      "label": "ASSIGNING",
      "crud": ["create"]
    },
    {
      "from": "sfn-assignShifts",
      "to": "s3-ctx-assignShifts",
      "label": "read assignment payload, update metrics",
      "crud": ["read", "update"]
    },
    {
      "from": "sfn-finishJob",
      "to": "mongo-jobs-finishJob",
      "label": "update status (FINISHED)",
      "crud": ["update"]
    },
    {
      "from": "sfn-finishJob",
      "to": "sqs-ws-finishJob",
      "label": "FINISHED",
      "crud": ["create"]
    },
    {
      "from": "skello-app (data)",
      "to": "pg-skello-read",
      "label": "read shop, users, contracts, teams, postes",
      "crud": ["read"]
    },
    {
      "from": "skello-app (assign)",
      "to": "pg-skello-write",
      "label": "write shifts, badgings, shift_swaps",
      "crud": ["update", "delete"]
    }
  ]
})

export default auto_planning_generation
