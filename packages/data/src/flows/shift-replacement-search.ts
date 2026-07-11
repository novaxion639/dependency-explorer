import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

const shift_replacement_search: ServiceFlow = ServiceFlowSchema.parse({
  "id": "shift-replacement-search",
  "name": "Shift Replacement Search",
  "description": "A planner searches for a replacement for an uncovered shift. The frontend calls svc-automatic-scheduling (single synchronous Lambda, 29s timeout) which reads the target shift and postes from svc-search's MongoDB over VPC, fetches shop + users data from skello-app (with shift_id param to exclude already-replaced users via the shift_replacements table), reads all candidate assigned shifts from MongoDB, then runs 13 eligibility rule classes in-memory to rank candidates by availability and contract fit. A metrics report is sent to SQS and consumed by a separate Lambda that forwards to the data platform ingestion API.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-automatic-scheduling",
      "action": "Trigger — GET /shifts/{shiftId}/employee_replacements (JWT + API key auth)"
    },
    {
      "from": "svc-automatic-scheduling",
      "to": "skello-app",
      "action": "GET shop + users data (parallel) — users endpoint includes shift_id to exclude already-replaced users via shift_replacements table"
    },
    {
      "from": "svc-automatic-scheduling",
      "to": "skello-app-front (response)",
      "action": "HTTP 200 — ranked replacement candidates sorted by availability and contract fit"
    }
  ],
  "infraNodes": [
    {
      "id": "mongo-svc-search",
      "type": "mongodb",
      "label": "svc-search DB (direct VPC)",
      "description": "4 read queries: (1) shift by skelloId, (2) poste for shift, (3) assigned shifts for all candidate users in the week, (4) postes for those shifts — collections: shifts, rawPoste"
    },
    {
      "id": "pg-skello-read",
      "type": "postgresql",
      "label": "skello_production (RDS)",
      "description": "Read shop, alerts config, weekly options, users, contracts, dpae_deposits, prospects, shift_replacements (for exclusion)"
    },
    {
      "id": "sqs-metrics",
      "type": "sqs",
      "label": "shiftsEmployeeReplacementsMetrics",
      "description": "Replacement metrics report — consumed by handleSuggestionsMetrics Lambda (120s timeout) which POSTs to data platform ingestion API"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-automatic-scheduling",
      "to": "mongo-svc-search",
      "label": "read shift, postes, candidate shifts",
      "crud": ["read"]
    },
    {
      "from": "skello-app",
      "to": "pg-skello-read",
      "label": "read shop, users, contracts, shift_replacements",
      "crud": ["read"]
    },
    {
      "from": "svc-automatic-scheduling",
      "to": "sqs-metrics",
      "label": "send replacement metrics report",
      "crud": ["create"]
    }
  ],
  "codeUnits": [
    {
      "id": "cu-rep-controller",
      "service": "svc-automatic-scheduling",
      "kind": "controller",
      "label": "ShiftsEmployeeReplacementsController",
      "path": "src/Controller/ShiftsEmployeeReplacementsController.ts",
      "description": "GET /shifts/{shiftId}/employee_replacements — the single synchronous Lambda entry (29s timeout)"
    },
    {
      "id": "cu-rep-manager",
      "service": "svc-automatic-scheduling",
      "kind": "manager",
      "label": "ShiftsEmployeeReplacementsManager#computeSuggestions",
      "path": "src/Manager/ShiftsEmployeeReplacementsManager.ts",
      "description": "Orchestrates fetch → process → sort → count and ships the metrics report"
    },
    {
      "id": "cu-rep-fetcher",
      "service": "svc-automatic-scheduling",
      "kind": "service",
      "label": "SuggestionsDataFetcher",
      "path": "src/Manager/Fetcher/SuggestionsDataFetcher.ts",
      "description": "Parallel data pull: shop + users from the monolith (SkelloAppRepository, shift_id param excludes already-replaced users), shift/postes/candidate shifts from svc-search's Mongo (ShiftRepository, PosteRepository)"
    },
    {
      "id": "cu-rep-processor",
      "service": "svc-automatic-scheduling",
      "kind": "service",
      "label": "SuggestionsProcessor",
      "path": "src/Manager/ShiftsEmployeeReplacements/Processor/SuggestionsProcessor.ts",
      "description": "Runs the eligibility rule classes in-memory over every candidate"
    },
    {
      "id": "cu-rep-sorter",
      "service": "svc-automatic-scheduling",
      "kind": "service",
      "label": "SuggestionsSorter",
      "path": "src/Manager/ShiftsEmployeeReplacements/Sort/SuggestionsSorter.ts",
      "description": "Ranks the eligible candidates by availability and contract fit"
    },
    {
      "id": "cu-rep-metrics-repo",
      "service": "svc-automatic-scheduling",
      "kind": "service",
      "label": "MetricsSqsRepository",
      "path": "src/Repository/MetricsSqsRepository.ts",
      "description": "Sends the replacement metrics report to the shiftsEmployeeReplacementsMetrics queue"
    },
    {
      "id": "cu-rep-metrics-job",
      "service": "svc-automatic-scheduling",
      "kind": "job",
      "label": "MetricsTrackingHandlerJob",
      "path": "src/Handler/MetricsTrackingHandlerJob.ts",
      "description": "Separate Lambda (120s) consuming the metrics queue and forwarding to the data-platform ingestion API"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-rep-controller",
      "label": "GET /shifts/{shiftId}/employee_replacements",
      "mode": "sync"
    },
    {
      "from": "cu-rep-controller",
      "to": "cu-rep-manager",
      "label": "ShiftsEmployeeReplacementsManager#computeSuggestions",
      "mode": "sync"
    },
    {
      "from": "cu-rep-manager",
      "to": "cu-rep-fetcher",
      "label": "SuggestionsDataFetcher — parallel pulls",
      "mode": "sync"
    },
    {
      "from": "cu-rep-fetcher",
      "to": "skello-app",
      "label": "SkelloAppRepository — shop + users (shift_id exclusion)",
      "mode": "sync"
    },
    {
      "from": "cu-rep-fetcher",
      "to": "mongo-svc-search",
      "label": "ShiftRepository / PosteRepository — shift, postes, candidate shifts",
      "mode": "sync",
      "crud": ["read"]
    },
    {
      "from": "cu-rep-manager",
      "to": "cu-rep-processor",
      "label": "SuggestionsProcessor — eligibility rules",
      "mode": "sync"
    },
    {
      "from": "cu-rep-manager",
      "to": "cu-rep-sorter",
      "label": "SuggestionsSorter — rank candidates",
      "mode": "sync"
    },
    {
      "from": "cu-rep-manager",
      "to": "cu-rep-metrics-repo",
      "label": "MetricsSqsRepository — metrics report",
      "mode": "async-job"
    },
    {
      "from": "cu-rep-metrics-repo",
      "to": "sqs-metrics",
      "label": "SendMessage",
      "mode": "async-job"
    },
    {
      "from": "sqs-metrics",
      "to": "cu-rep-metrics-job",
      "label": "SQS trigger",
      "mode": "async-job"
    }
  ]
})

export default shift_replacement_search
