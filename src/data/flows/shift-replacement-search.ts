import { ServiceFlowSchema } from '../schemas'
import type { ServiceFlow } from '../schemas'

const shift_replacement_search: ServiceFlow = ServiceFlowSchema.parse({
  "id": "shift-replacement-search",
  "name": "Shift Replacement Search",
  "description": "A planner searches for a replacement for an uncovered shift. The frontend queries svc-automatic-scheduling which ranks candidates by availability and contract data from svc-employees. The planner confirms an offer via the monolith, which emits an event and notifies the candidate by email.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-automatic-scheduling",
      "action": "POST /shift-replacements — find replacement candidates for uncovered shift"
    },
    {
      "from": "svc-automatic-scheduling",
      "to": "svc-employees",
      "action": "GET /employees — fetch availability and contract data to rank candidates"
    },
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST /v3/shifts/replacements — confirm offer to selected candidate"
    },
    {
      "from": "skello-app",
      "to": "svc-events",
      "action": "POST /events — emit shift.replacement-offered event"
    },
    {
      "from": "svc-events",
      "to": "svc-communications-v2",
      "action": "SQS email-high — notify candidate of replacement offer"
    }
  ],
  "infraNodes": [
    {
      "id": "lambda-replacement-rank",
      "type": "lambda",
      "label": "shift-replacement-rank",
      "description": "ML job ranking replacement candidates by availability, contract and proximity"
    },
    {
      "id": "pg-employees-replacement",
      "type": "postgresql",
      "label": "svcEmployees-{env}",
      "description": "Employee contracts and availability — read to rank candidates"
    },
    {
      "id": "pg-skello-replacement",
      "type": "postgresql",
      "label": "skello_production",
      "description": "Records the replacement offer on the shift"
    },
    {
      "id": "dynamo-events-replacement",
      "type": "dynamodb",
      "label": "svcEvents-{env}",
      "description": "Audit event store for shift.replacement-offered"
    },
    {
      "id": "sqs-replacement",
      "type": "sqs",
      "label": "skello-sqs-events",
      "description": "Async event queue for shift replacement lifecycle"
    },
    {
      "id": "lambda-notify-replacement",
      "type": "lambda",
      "label": "shift-notify-dispatch",
      "description": "Dispatches replacement offer notification to the candidate"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-automatic-scheduling",
      "to": "lambda-replacement-rank",
      "label": "invoke ranking"
    },
    {
      "from": "svc-employees",
      "to": "pg-employees-replacement",
      "label": "read contracts"
    },
    {
      "from": "skello-app",
      "to": "pg-skello-replacement",
      "label": "record offer"
    },
    {
      "from": "skello-app",
      "to": "sqs-replacement",
      "label": "enqueue"
    },
    {
      "from": "svc-events",
      "to": "dynamo-events-replacement",
      "label": "write"
    },
    {
      "from": "svc-communications-v2",
      "to": "lambda-notify-replacement",
      "label": "invoke"
    }
  ]
})

export default shift_replacement_search
