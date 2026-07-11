import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Code layer traced 2026-07-11 — and a correction: creation does NOT pull
// KPIs. The svc-kpis-v2 calibration happens on the consultation path
// (dynamic rule generation in WorkloadPlanManagerV2#get); saving a forecast
// is a plain batch write. Dual-store during the Dynamo→Mongo migration:
// the V2 surface writes Mongo, the V1 surface (upsertAction) still writes
// DynamoDB, whose table stream feeds the dynamo→mongo replication
// (TriggerDynamoToFullLoadSqsJobHandler).
const workload_plan_creation: ServiceFlow = ServiceFlowSchema.parse({
  "id": "workload-plan-creation",
  "name": "Workload Plan Creation",
  "description": "A planner saves a workload forecast. The V2 surface (WorkloadPlanV2Controller#deleteAndUpsert) batch-replaces the plan rows in the service's MongoDB; the V1 surface (WorkloadPlanController#upsertAction) still writes the DynamoDB store, whose table stream drives the dynamo→mongo replication job — the migration's write side. No KPI call happens here (corrected 2026-07-11: the svc-kpis-v2 calibration belongs to the consultation path's dynamic rule generation).",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-workload-plan",
      "action": "POST /v2/workload-plans — batch delete-and-upsert (V1 POST /workload-plans still live)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-wpcr-controller-v2",
      "service": "svc-workload-plan",
      "kind": "controller",
      "label": "WorkloadPlanV2Controller#deleteAndUpsert",
      "path": "src/Controller/WorkloadPlan/WorkloadPlanV2Controller.ts",
      "description": "Permission-gated batch replace of the shop's workload plans"
    },
    {
      "id": "cu-wpcr-manager-v2",
      "service": "svc-workload-plan",
      "kind": "manager",
      "label": "WorkloadPlanManagerV2#batchDeleteAndUpsert",
      "path": "src/Manager/WorkloadPlanManagerV2.ts",
      "description": "Writes the plan batch to the Mongo repositories"
    },
    {
      "id": "cu-wpcr-controller-v1",
      "service": "svc-workload-plan",
      "kind": "controller",
      "label": "WorkloadPlanController#upsertAction",
      "path": "src/Controller/WorkloadPlan/WorkloadPlanController.ts",
      "description": "V1 write surface — batchDelete + batchUpsert on the DynamoDB-backed manager (still live during the migration)"
    },
    {
      "id": "cu-wpcr-replication",
      "service": "svc-workload-plan",
      "kind": "job",
      "label": "TriggerDynamoToFullLoadSqsJobHandler",
      "path": "src/Handler/Jobs/TriggerDynamoToFullLoadSqsJobHandler.ts",
      "description": "Consumes the V1 table's DynamoDB stream and replicates rows into Mongo — the migration bridge"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "svc-workload-plan",
      "label": "save forecast (V2 client; V1 client still shipped)",
      "mode": "sync"
    },
    {
      "from": "svc-workload-plan",
      "to": "cu-wpcr-controller-v2",
      "label": "API GW → WorkloadPlanV2Controller#deleteAndUpsert",
      "mode": "sync"
    },
    {
      "from": "svc-workload-plan",
      "to": "cu-wpcr-controller-v1",
      "label": "API GW → WorkloadPlanController#upsertAction",
      "mode": "sync",
      "condition": "V1 client path (migration in flight)"
    },
    {
      "from": "cu-wpcr-controller-v2",
      "to": "cu-wpcr-manager-v2",
      "label": "WorkloadPlanManagerV2#batchDeleteAndUpsert",
      "mode": "sync"
    },
    {
      "from": "cu-wpcr-manager-v2",
      "to": "mongo-workload-cr",
      "label": "batch replace",
      "mode": "sync",
      "crud": ["create", "update", "delete"]
    },
    {
      "from": "cu-wpcr-controller-v1",
      "to": "dynamo-workload-cr",
      "label": "WorkloadPlanManager batchDelete + batchUpsert",
      "mode": "sync",
      "crud": ["create", "update", "delete"]
    },
    {
      "from": "dynamo-workload-cr",
      "to": "cu-wpcr-replication",
      "label": "DynamoDB table stream",
      "mode": "async-event"
    },
    {
      "from": "cu-wpcr-replication",
      "to": "mongo-workload-cr",
      "label": "dynamo → mongo replication",
      "mode": "sync",
      "crud": ["create", "update"]
    }
  ],
  "infraNodes": [
    {
      "id": "mongo-workload-cr",
      "type": "mongodb",
      "label": "svc-workload-plan MongoDB",
      "description": "V2 store — the migration's destination"
    },
    {
      "id": "dynamo-workload-cr",
      "type": "dynamodb",
      "label": "workloadPlan (V1)",
      "description": "Legacy store; its stream feeds the replication bridge"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-workload-plan",
      "to": "mongo-workload-cr",
      "label": "V2 writes + replicated rows",
      "crud": ["create", "update", "delete"]
    },
    {
      "from": "svc-workload-plan",
      "to": "dynamo-workload-cr",
      "label": "V1 writes",
      "crud": ["create", "update", "delete"]
    }
  ]
})

export default workload_plan_creation
