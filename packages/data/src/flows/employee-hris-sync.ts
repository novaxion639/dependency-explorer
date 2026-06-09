import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

const employee_hris_sync: ServiceFlow = ServiceFlowSchema.parse({
  "id": "employee-hris-sync",
  "name": "Employee HRIS Sync",
  "description": "A manager updates an employee profile. The change is synced to the HRIS, an event is emitted, and the frontend refreshes the profile.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-employees",
      "action": "PUT /employees/:id — update employee profile"
    },
    {
      "from": "svc-employees",
      "to": "svc-hris",
      "action": "POST /sync — push employee to HRIS"
    },
    {
      "from": "svc-employees",
      "to": "svc-events",
      "action": "POST /events — emit employee.updated event"
    },
    {
      "from": "skello-app-front",
      "to": "svc-employees",
      "action": "GET /employees/:id — fetch updated profile"
    }
  ],
  "infraNodes": [
    {
      "id": "cdc-employees",
      "type": "cdc",
      "label": "employees-cdc",
      "description": "Change Data Capture on employees table"
    },
    {
      "id": "pg-employees",
      "type": "postgresql",
      "label": "employees-db",
      "description": "Core employee store"
    },
    {
      "id": "dynamo-events-hris",
      "type": "dynamodb",
      "label": "svcEvents-{env}",
      "description": "HRIS audit events"
    },
    {
      "id": "mongo-hris",
      "type": "mongodb",
      "label": "hris-mirror",
      "description": "Denormalised HRIS read model"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-employees",
      "to": "pg-employees",
      "label": "write",
      "crud": ["create"]
    },
    {
      "from": "pg-employees",
      "to": "cdc-employees",
      "label": "change event"
    },
    {
      "from": "svc-hris",
      "to": "mongo-hris",
      "label": "sync",
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
