import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

const auto_planning_generation: ServiceFlow = ServiceFlowSchema.parse({
  "id": "auto-planning-generation",
  "name": "AI Auto-Planning Generation",
  "description": "Triggered by the frontend via POST /automatic_assignment/compute, which returns a websocketId for live progress tracking. svc-automatic-scheduling creates a job in MongoDB (STARTED) and starts an AWS Step Functions pipeline. Each Lambda step updates the job status in MongoDB and sends a progress notification to websocket-topicMessage SQS (except the Python solver, which has no TS notification access — the aggregate step pre-sends SOLVING on its behalf). Context (shifts, postes, users, shop) travels through the SFN context S3 bucket (svc-automatic-scheduling.assignment): the data fetcher writes it, each eligibility batch reads it and writes its result, the aggregate step reads both and writes the solver payload, the solver writes the assignments and assignShifts reads them back; the SFN state carries the object keys (contextKey, solverPayloadKey, assignmentPayloadKey).",
  "trigger": {
    "actor": "manager",
    "role": "planner"
  },
  "primaryArea": "automatic-scheduling",
  "chapters": [
    {
      "title": "A planner starts auto-scheduling",
      "summary": "The front asks svc-automatic-scheduling to compute; it records a started job and returns a websocket id for live progress.",
      "refs": [
        "svc-automatic-scheduling",
        "mongo-jobs",
        "sm-auto-assign"
      ]
    },
    {
      "title": "The pipeline fetches its context",
      "summary": "The first step marks the job as fetching, reads shop and staff from skello-app and shifts from svc-search, and writes the context to S3.",
      "refs": [
        "cu-as-fetch",
        "skello-app (data)",
        "pg-skello-read",
        "mongo-svc-search",
        "s3-ctx",
        "sqs-ws"
      ]
    },
    {
      "title": "Empty or filtered pools stop early",
      "summary": "With nothing to assign the job finishes at once; the filter drops non-compliant employees, and a pool it empties skips straight to assignment.",
      "refs": [
        "sms-empty",
        "cu-as-filter",
        "sms-filtered"
      ]
    },
    {
      "title": "Eligibility is checked in batches",
      "summary": "Employee batches are checked in parallel; each reads the context from S3, writes its result back there, and sends a progress message.",
      "refs": [
        "sms-map",
        "cu-as-eligibility",
        "s3-ctx",
        "sqs-ws"
      ]
    },
    {
      "title": "Results are combined and solved",
      "summary": "Batch results are aggregated and the solving status pre-sent; the Python solver reads its payload from S3 and writes the assignments back there.",
      "refs": [
        "cu-as-aggregate",
        "cu-as-solver",
        "s3-ctx"
      ]
    },
    {
      "title": "The result goes back to skello-app",
      "summary": "The assign step sets the job to assigning, tells the planner, and calls skello-app's private write-back with an API key.",
      "refs": [
        "cu-as-assign-job",
        "cu-as-assign-manager",
        "cu-as-skello-repo",
        "cu-as-controller",
        "sqs-ws"
      ]
    },
    {
      "title": "Assignments are saved",
      "summary": "skello-app persists the optimised user-to-shift assignments, writing shifts, badgings and swaps in one transaction.",
      "refs": [
        "cu-as-controller",
        "cu-as-assignment",
        "cu-as-save",
        "skello-app (assign)",
        "pg-skello-write"
      ]
    },
    {
      "title": "Generated shifts are created",
      "summary": "In automatic shift creation mode, the write-back bulk-inserts the generated shifts.",
      "refs": [
        "cu-as-controller",
        "cu-as-bulk-create",
        "pg-skello-write"
      ]
    },
    {
      "title": "Alerts and counters are refreshed",
      "summary": "Alerts are recomputed for the touched shifts, and planning-hours, RCR and paid-leave counters are recalculated.",
      "refs": [
        "cu-as-assignment",
        "cu-as-alert",
        "cu-as-tracker-v2"
      ]
    },
    {
      "title": "Weekly options are marked stale",
      "summary": "A background job is queued for each affected employee and week to mark its weekly options stale.",
      "refs": [
        "cu-as-assignment",
        "cu-as-cb-job"
      ]
    },
    {
      "title": "The planner sees the result",
      "summary": "The job is marked finished, the final progress message arrives and the planning shows the optimised roster.",
      "refs": [
        "cu-as-finish",
        "mongo-jobs",
        "sqs-ws"
      ]
    },
    {
      "title": "Failures go to the error handler",
      "summary": "Any step that fails goes to the error handler, which marks the job failed and alerts the team.",
      "refs": [
        "cu-as-error",
        "mongo-jobs"
      ]
    }
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
      "to": "skello-app (data)",
      "action": "GET private/svc_shops/shops/:id — shop, teams, postes, contract_types (from PostgreSQL)"
    },
    {
      "from": "svc-automatic-scheduling",
      "to": "skello-app (data)",
      "action": "GET /v3/api/automatic_scheduling/users — users, contracts, memberships, teams, licenses (from PostgreSQL)"
    },
    {
      "from": "svc-automatic-scheduling",
      "to": "skello-app (assign)",
      "action": "PATCH /v3/api/plannings/shifts — update shifts, badgings, shift_swaps in PostgreSQL"
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
    },
    {
      "id": "cu-as-fetch",
      "service": "svc-automatic-scheduling",
      "kind": "job",
      "label": "AutoAssignDataFetcherHandler",
      "path": "src/Handler/AutoAssignDataFetcherHandler.ts",
      "description": "First pipeline step (JobSfnDataFetchingLambda): marks the job DATA_FETCHING, reads shop, teams, users and contracts from skello-app and shifts and postes from svc-search, and writes the context to the SFN context bucket"
    },
    {
      "id": "cu-as-filter",
      "service": "svc-automatic-scheduling",
      "kind": "job",
      "label": "AutoAssignFilterNonCompliantUsersHandler",
      "path": "src/Handler/AutoAssignFilterNonCompliantUsersHandler.ts",
      "description": "Drops employees whose contract cannot take any shift; when it empties the pool it writes a synthetic solver output so the machine skips straight to assignment"
    },
    {
      "id": "cu-as-eligibility",
      "service": "svc-automatic-scheduling",
      "kind": "job",
      "label": "SfnComputeEligibilityHandlerJob",
      "path": "src/Handler/AutoAssign/SfnComputeEligibilityHandlerJob.ts",
      "description": "Map item processor: computes eligibility for one employee batch from the S3 context and writes the batch result back"
    },
    {
      "id": "cu-as-aggregate",
      "service": "svc-automatic-scheduling",
      "kind": "job",
      "label": "SfnAggregateEligibilityHandlerJob",
      "path": "src/Handler/AutoAssign/SfnAggregateEligibilityHandlerJob.ts",
      "description": "Aggregates the batch results, builds the solver payload and pre-sends SOLVING on the solver's behalf"
    },
    {
      "id": "cu-as-assign-job",
      "service": "svc-automatic-scheduling",
      "kind": "job",
      "label": "SfnAssignShiftsHandlerJob",
      "path": "src/Handler/AutoAssign/SfnAssignShiftsHandlerJob.ts",
      "description": "Reads the assignments from S3 and calls skello-app's private write-back with an API key"
    },
    {
      "id": "cu-as-finish",
      "service": "svc-automatic-scheduling",
      "kind": "job",
      "label": "SfnFinishAutoAssignJobHandlerJob",
      "path": "src/Handler/AutoAssign/SfnFinishAutoAssignJobHandlerJob.ts",
      "description": "Marks the job FINISHED with its assigned and unassigned counts and sends the final progress message"
    },
    {
      "id": "cu-as-error",
      "service": "svc-automatic-scheduling",
      "kind": "job",
      "label": "SfnErrorHandlerJob",
      "path": "src/Handler/AutoAssign/SfnErrorHandlerJob.ts",
      "description": "Catches any failing step: marks the job FAILED, logs the trace to S3 and alerts the auto-assign failure Slack channel"
    },
    {
      "id": "cu-as-assign-manager",
      "service": "svc-automatic-scheduling",
      "kind": "manager",
      "label": "AssignShiftsManager",
      "path": "src/Manager/AutoAssign/AssignShiftsManager.ts",
      "description": "Loads the assignments from S3, sets the job to ASSIGNING and persists them through skello-app (PATCH /v3/api/automatic_scheduling/shifts when assignments are present)"
    },
    {
      "id": "cu-as-skello-repo",
      "service": "svc-automatic-scheduling",
      "kind": "client",
      "label": "SkelloAppRepository",
      "path": "src/Repository/SkelloAppRepository.ts",
      "description": "HTTP client for skello-app's /v3/api/automatic_scheduling surface: shop and users reads, the shifts write-back and its undo"
    }
  ],
  "codeEdges": [
    {
      "from": "svc-automatic-scheduling",
      "to": "sm-auto-assign",
      "label": "start AutoAssign",
      "mode": "async-job"
    },
    {
      "from": "cu-as-fetch",
      "to": "skello-app",
      "label": "shop, teams, users, contracts",
      "mode": "sync"
    },
    {
      "from": "cu-as-assign-job",
      "to": "cu-as-assign-manager",
      "label": "assign",
      "mode": "sync"
    },
    {
      "from": "cu-as-assign-manager",
      "to": "cu-as-skello-repo",
      "label": "persist assignments",
      "mode": "sync"
    },
    {
      "from": "cu-as-skello-repo",
      "to": "cu-as-controller",
      "label": "PATCH /v3/api/automatic_scheduling/shifts (API key)",
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
  "stateMachines": [
    {
      "id": "sm-auto-assign",
      "service": "svc-automatic-scheduling",
      "machine": "AutoAssignStepFunction",
      "label": "AutoAssign state machine",
      "file": "serverless/step-function/autoAssign/autoAssignSfn.ts",
      "start": "sms-fetch",
      "errorHandler": "sms-error",
      "states": [
        {
          "id": "sms-fetch",
          "name": "sfnFetchData",
          "type": "task",
          "label": "fetch data",
          "unit": "cu-as-fetch",
          "catches": true,
          "next": "sms-empty",
          "stores": [
            {
              "store": "mongo-jobs",
              "label": "job status",
              "crud": [
                "update"
              ]
            },
            {
              "store": "sqs-ws",
              "label": "progress"
            },
            {
              "store": "s3-ctx",
              "label": "context",
              "crud": [
                "create"
              ]
            },
            {
              "store": "mongo-svc-search",
              "label": "shifts, postes",
              "crud": [
                "read"
              ]
            }
          ]
        },
        {
          "id": "sms-empty",
          "name": "EmptyCheck",
          "type": "choice",
          "label": "empty?",
          "choices": [
            {
              "when": "no batches",
              "next": "sms-finish"
            }
          ],
          "default": "sms-filter"
        },
        {
          "id": "sms-filter",
          "name": "sfnFilterNonCompliantUsers",
          "type": "task",
          "label": "filter users",
          "unit": "cu-as-filter",
          "catches": true,
          "next": "sms-filtered",
          "stores": [
            {
              "store": "mongo-jobs",
              "label": "job status",
              "crud": [
                "update"
              ]
            },
            {
              "store": "s3-ctx",
              "label": "context",
              "crud": [
                "read",
                "update"
              ]
            }
          ]
        },
        {
          "id": "sms-filtered",
          "name": "PostFilterCheck",
          "type": "choice",
          "label": "all filtered?",
          "choices": [
            {
              "when": "pool emptied",
              "next": "sms-assign"
            }
          ],
          "default": "sms-map"
        },
        {
          "id": "sms-map",
          "name": "MapState",
          "type": "map",
          "label": "per batch",
          "concurrency": 10,
          "catches": true,
          "next": "sms-aggregate",
          "states": [
            {
              "id": "sms-eligibility",
              "name": "sfnComputeEligibilityInBatches",
              "type": "task",
              "label": "eligibility per batch",
              "unit": "cu-as-eligibility",
              "stores": [
                {
                  "store": "mongo-jobs",
                  "label": "job status",
                  "crud": [
                    "update"
                  ]
                },
                {
                  "store": "sqs-ws",
                  "label": "progress"
                },
                {
                  "store": "s3-ctx",
                  "label": "context",
                  "crud": [
                    "read",
                    "create"
                  ]
                }
              ]
            }
          ]
        },
        {
          "id": "sms-aggregate",
          "name": "jobSfnAggregateEligibility",
          "type": "task",
          "label": "aggregate",
          "unit": "cu-as-aggregate",
          "catches": true,
          "next": "sms-solve",
          "stores": [
            {
              "store": "mongo-jobs",
              "label": "job status",
              "crud": [
                "update"
              ]
            },
            {
              "store": "sqs-ws",
              "label": "progress"
            },
            {
              "store": "s3-ctx",
              "label": "context",
              "crud": [
                "read",
                "create"
              ]
            }
          ]
        },
        {
          "id": "sms-solve",
          "name": "sfnSolver",
          "type": "task",
          "label": "solve",
          "unit": "cu-as-solver",
          "catches": true,
          "next": "sms-assign",
          "stores": [
            {
              "store": "s3-ctx",
              "label": "context",
              "crud": [
                "read",
                "create"
              ]
            }
          ]
        },
        {
          "id": "sms-assign",
          "name": "sfnAssignShifts",
          "type": "task",
          "label": "assign shifts",
          "unit": "cu-as-assign-job",
          "catches": true,
          "next": "sms-finish",
          "stores": [
            {
              "store": "mongo-jobs",
              "label": "job status",
              "crud": [
                "update"
              ]
            },
            {
              "store": "sqs-ws",
              "label": "progress"
            },
            {
              "store": "s3-ctx",
              "label": "context",
              "crud": [
                "read"
              ]
            }
          ]
        },
        {
          "id": "sms-finish",
          "name": "sfnFinishAutoAssignJob",
          "type": "task",
          "label": "finish job",
          "unit": "cu-as-finish",
          "catches": true,
          "stores": [
            {
              "store": "mongo-jobs",
              "label": "job status",
              "crud": [
                "update"
              ]
            },
            {
              "store": "sqs-ws",
              "label": "progress"
            }
          ]
        },
        {
          "id": "sms-error",
          "name": "sfnErrorHandler",
          "type": "task",
          "label": "error handler",
          "unit": "cu-as-error",
          "stores": [
            {
              "store": "mongo-jobs",
              "label": "job status",
              "crud": [
                "update"
              ]
            }
          ]
        }
      ]
    }
  ],
  "infraNodes": [
    {
      "id": "mongo-jobs",
      "type": "mongodb",
      "label": "automatic_assignment_jobs",
      "resources": [
        "mongo:svc-automatic-scheduling"
      ],
      "description": "Job record: created STARTED by the trigger, then updated by every step of the state machine"
    },
    {
      "id": "mongo-svc-search",
      "type": "mongodb",
      "label": "svc-search DB (direct VPC)",
      "resources": [
        "mongo:svc-search"
      ],
      "description": "Direct MongoDB reads — shifts (unassigned + assigned) and rawPoste collections"
    },
    {
      "id": "sqs-ws",
      "type": "sqs",
      "label": "websocket-topicMessage",
      "resources": [
        "sqs:websocket-topicMessage"
      ],
      "description": "Progress messages to the planner's websocket channel, one per step status"
    },
    {
      "id": "s3-ctx",
      "type": "s3",
      "label": "svc-automatic-scheduling.assignment",
      "resources": [
        "s3:svc-automatic-scheduling.assignment"
      ],
      "description": "SFN context bucket: the context, batch results, solver payload, assignments, metrics and error traces; the state carries their object keys"
    },
    {
      "id": "pg-skello-read",
      "type": "postgresql",
      "label": "skello_production (RDS)",
      "resources": [
        "pg:skello_production.shops",
        "pg:skello_production.teams",
        "pg:skello_production.postes",
        "pg:skello_production.contract_types",
        "pg:skello_production.users",
        "pg:skello_production.contracts",
        "pg:skello_production.memberships",
        "pg:skello_production.licenses",
        "pg:skello_production.contract_amendments"
      ],
      "description": "Read shops, teams, postes, contract_types, users, contracts, memberships, licenses, amendments"
    },
    {
      "id": "pg-skello-write",
      "type": "postgresql",
      "label": "skello_production (RDS)",
      "resources": [
        "pg:skello_production.shifts",
        "pg:skello_production.badgings",
        "pg:skello_production.shift_swaps",
        "pg:skello_production.shift_replacements"
      ],
      "description": "Write shifts, badgings, shift_swaps, shift_replacements in a transaction"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-automatic-scheduling",
      "to": "mongo-jobs",
      "label": "create job (STARTED)",
      "crud": [
        "create"
      ]
    },
    {
      "from": "skello-app (data)",
      "to": "pg-skello-read",
      "label": "read shop, users, contracts, teams, postes",
      "crud": [
        "read"
      ]
    },
    {
      "from": "skello-app (assign)",
      "to": "pg-skello-write",
      "label": "write shifts, badgings, shift_swaps",
      "crud": [
        "update",
        "delete"
      ]
    }
  ]
})

export default auto_planning_generation
