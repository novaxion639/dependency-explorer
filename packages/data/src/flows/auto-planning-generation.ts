import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

const auto_planning_generation: ServiceFlow = ServiceFlowSchema.parse({
  "id": "auto-planning-generation",
  "name": "AI Auto-Planning Generation",
  "description": "Triggered by the frontend via POST /automatic_assignment/compute, which returns a websocketId for live progress tracking. svc-automatic-scheduling creates a job in MongoDB (STARTED) and starts an AWS Step Functions pipeline. Each Lambda step updates the job status in MongoDB and sends a progress notification to websocket-topicMessage SQS (except the Python solver, which has no TS notification access — the aggregate step pre-sends OPTIMIZING on its behalf). Context (shifts, postes, users, shop) passes through the SFN state payload, not S3.",
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
      "action": "GET /v3/api/plannings/svc_automatic_scheduling/users — users, contracts, memberships, teams, licenses (from PostgreSQL)"
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
      "action": "SFN step 4 — Python CP-SAT optimizer (10 GB RAM, 15 min timeout, no external calls)"
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
      "action": "SFN step 6 — mark FINISHED, enqueue metrics, send final WebSocket notification"
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
      }
    ],
    "codeEdges": [
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
      "label": "automatic_scheduling_jobs",
      "description": "Create job record (status: STARTED, websocketId: UUID)"
    },
    {
      "id": "mongo-svc-search",
      "type": "mongodb",
      "label": "svc-search DB (direct VPC)",
      "description": "Direct MongoDB reads — shifts (unassigned + assigned) and rawPoste collections"
    },
    {
      "id": "mongo-jobs-dataFetcher",
      "type": "mongodb",
      "label": "automatic_scheduling_jobs",
      "description": "Update job status → DATA_FETCHING"
    },
    {
      "id": "sqs-ws-dataFetcher",
      "type": "sqs",
      "label": "websocket-topicMessage",
      "description": "Send DATA_FETCHING notification to frontend WebSocket channel"
    },
    {
      "id": "mongo-jobs-eligibility",
      "type": "mongodb",
      "label": "automatic_scheduling_jobs",
      "description": "Update job status → ELIGIBILITY_COMPLIANCE_CHECK"
    },
    {
      "id": "sqs-ws-eligibility",
      "type": "sqs",
      "label": "websocket-topicMessage",
      "description": "Send ELIGIBILITY_COMPLIANCE_CHECK (once per batch invocation)"
    },
    {
      "id": "mongo-jobs-aggregate",
      "type": "mongodb",
      "label": "automatic_scheduling_jobs",
      "description": "Update job status → ELIGIBILITY_AGGREGATION"
    },
    {
      "id": "sqs-ws-aggregate",
      "type": "sqs",
      "label": "websocket-topicMessage",
      "description": "Send ELIGIBILITY_AGGREGATION + OPTIMIZING (pre-sent for Python solver)"
    },
    {
      "id": "mongo-jobs-assignShifts",
      "type": "mongodb",
      "label": "automatic_scheduling_jobs",
      "description": "Update job status → ASSIGNING"
    },
    {
      "id": "sqs-ws-assignShifts",
      "type": "sqs",
      "label": "websocket-topicMessage",
      "description": "Send ASSIGNING notification to frontend WebSocket channel"
    },
    {
      "id": "mongo-jobs-finishJob",
      "type": "mongodb",
      "label": "automatic_scheduling_jobs",
      "description": "Update job status → FINISHED"
    },
    {
      "id": "sqs-ws-finishJob",
      "type": "sqs",
      "label": "websocket-topicMessage",
      "description": "Send FINISHED notification to frontend WebSocket channel"
    },
    {
      "id": "sqs-metrics",
      "type": "sqs",
      "label": "autoAssignMetrics",
      "description": "Job-completion metrics consumed by handleAutoAssignMetrics Lambda"
    },
    {
      "id": "pg-skello-read",
      "type": "postgresql",
      "label": "skello_production (RDS)",
      "description": "Read shops, teams, postes, contract_types, users, contracts, memberships, licenses, amendments"
    },
    {
      "id": "pg-skello-write",
      "type": "postgresql",
      "label": "skello_production (RDS)",
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
      "from": "sfn-aggregate",
      "to": "mongo-jobs-aggregate",
      "label": "update status",
      "crud": ["update"]
    },
    {
      "from": "sfn-aggregate",
      "to": "sqs-ws-aggregate",
      "label": "ELIGIBILITY_AGGREGATION + OPTIMIZING",
      "crud": ["create"]
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
      "from": "sfn-finishJob",
      "to": "mongo-jobs-finishJob",
      "label": "update status (FINISHED)",
      "crud": ["update"]
    },
    {
      "from": "sfn-finishJob",
      "to": "sqs-metrics",
      "label": "enqueue job metrics",
      "crud": ["create"]
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
