import { ServiceFlowSchema } from '../schemas'
import type { ServiceFlow } from '../schemas'

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
      "to": "skello-app-front-response",
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
  ]
})

export default shift_replacement_search
