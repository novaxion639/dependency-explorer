import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Code layer traced 2026-07-11 — and a correction: creation does NOT pull
// KPIs. The svc-kpis-v2 calibration happens on the consultation path
// (dynamic rule generation in WorkloadPlanManagerV2#get); saving a forecast
// is a plain batch write.
const workload_plan_creation: ServiceFlow = ServiceFlowSchema.parse({
  "id": "workload-plan-creation",
  "name": "Workload Plan Creation",
  "description": "A planner saves a workload forecast. The V2 surface (WorkloadPlanV2Controller#deleteAndUpsert) batch-replaces the plan rows in the service's MongoDB. No KPI call happens here (corrected 2026-07-11: the svc-kpis-v2 calibration belongs to the consultation path's dynamic rule generation).",
  "trigger": {"actor": "manager"},
  "primaryArea": "workload-forecasting",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-workload-plan",
      "action": "POST /v2/workload-plans — batch delete-and-upsert"
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
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "svc-workload-plan",
      "label": "save forecast (V2 client)",
      "mode": "sync"
    },
    {
      "from": "svc-workload-plan",
      "to": "cu-wpcr-controller-v2",
      "label": "API GW → WorkloadPlanV2Controller#deleteAndUpsert",
      "mode": "sync"
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
    }
  ],
  "infraNodes": [
    {
      "id": "mongo-workload-cr",
      "type": "mongodb",
      "label": "svc-workload-plan MongoDB",
      "resources": ["mongo:svc-workload-plan"],
      "description": "Workload plans and rules"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-workload-plan",
      "to": "mongo-workload-cr",
      "label": "plan batch writes",
      "crud": ["create", "update", "delete"]
    }
  ]
})

export default workload_plan_creation
