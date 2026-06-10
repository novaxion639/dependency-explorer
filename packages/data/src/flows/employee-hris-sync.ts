import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

const employee_hris_sync: ServiceFlow = ServiceFlowSchema.parse({
  "id": "employee-hris-sync",
  "name": "Employee HRIS Sync",
  "description": "A manager updates an employee profile. svc-employees persists the change and emits an event; svc-hris pulls updated employee data on its sync runs and mirrors it to the connected HRIS integration. (Direction corrected 2026-06-10: the previously documented svc-employees→svc-hris push had no evidence in code — svc-hris is the puller, holding value imports of the employees client.)",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-employees",
      "action": "PUT /v1/employees/{id} — update employee profile"
    },
    {
      "from": "svc-employees",
      "to": "svc-events",
      "action": "POST /events — emit employee.updated event"
    },
    {
      "from": "svc-hris",
      "to": "svc-employees",
      "action": "GET /v1/employees — HRIS sync pulls updated employee data (UpsertEmployeeFromHrisDto)"
    },
    {
      "from": "skello-app-front",
      "to": "svc-employees",
      "action": "GET /v1/employees — refresh updated profile data"
    }
  ],
  "infraNodes": [
    {
      "id": "dynamo-employees",
      "type": "dynamodb",
      "label": "SvcEmployees ({env})",
      "description": "The service's only owned store — employee configs and sync state. (Corrected 2026-06-10 per the SvcEmployees architecture board: the previously documented service-owned PostgreSQL employees-db does not exist; employee master data lives in the monolith, fronted by private endpoints.)"
    },
    {
      "id": "kinesis-skelloapp-bus",
      "type": "kinesis",
      "label": "SkelloAppBus",
      "description": "Monolith CDC stream (public.users, shops, user_extended_info, contract) — consumed by svc-employees (KinesisFortifyEventUpdateJob); the CDC source is the monolith RDS, not a service-owned table"
    },
    {
      "id": "dynamo-events-hris",
      "type": "dynamodb",
      "label": "svcEvents-{env}",
      "description": "HRIS audit events"
    },
    {
      "id": "dynamo-hris",
      "type": "dynamodb",
      "label": "svcHris-{env}",
      "description": "HRIS integration credentials and sync state (corrected 2026-06-10: aligned with the service definition — the previously documented mongodb hris-mirror has no evidence)"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-employees",
      "to": "dynamo-employees",
      "label": "write",
      "crud": ["create"]
    },
    {
      "from": "svc-employees",
      "to": "kinesis-skelloapp-bus",
      "label": "consume monolith CDC",
      "crud": ["read"]
    },
    {
      "from": "svc-hris",
      "to": "dynamo-hris",
      "label": "sync state",
      "crud": ["update"]
    },
    {
      "from": "svc-events",
      "to": "dynamo-events-hris",
      "label": "write",
      "crud": ["create"]
    }
  ]
})

export default employee_hris_sync
