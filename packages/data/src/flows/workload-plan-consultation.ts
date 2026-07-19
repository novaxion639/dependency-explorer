import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Code layer traced 2026-07-11. The KPI calibration sits on THIS read path:
// WorkloadPlanManagerV2#get generates dynamic staffing rules from predictive
// KPIs (svc-kpis-v2, 15m period) when the shop's rules carry metrics — the
// earlier claim that creation did the calibration was wrong. The service is
// dual-store during the Dynamo→Mongo migration: the front ships BOTH clients
// (svc_workload_client V1 + svc_workload_plans_v2_client), and V1 reads come
// from the DynamoDB-backed WorkloadPlanManager.
const workload_plan_consultation: ServiceFlow = ServiceFlowSchema.parse({
  "id": "workload-plan-consultation",
  "name": "Workload Plan Consultation",
  "description": "A planner opens the workload forecasting view. The front queries svc-workload-plan directly (both generations ship: the V1 client reads the DynamoDB-backed store, the V2 client the MongoDB one — dual-store migration in flight). On the V2 path, WorkloadPlanManagerV2#get loads the plans and rules from Mongo, fetches the shop from svc-search's shared raw-shop collections, and — when rules reference metrics — pulls predictive KPIs from svc-kpis-v2 to generate dynamic staffing rules (degrades gracefully when the KPI service is unavailable). (Previously routed through svc-bff-planning, decommissioned.)",
  "trigger": {"actor": "manager"},
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-workload-plan",
      "action": "GET /workload-plans (V1) + GET /v2/workload-plans + /v2/workload-rules/{shopId} (V2)"
    },
    {
      "from": "svc-workload-plan",
      "to": "svc-kpis-v2",
      "action": "POST /kpis — predictive KPIs for dynamic rule generation (rules with metrics only)"
    },
    {
      "from": "svc-workload-plan",
      "to": "svc-search",
      "action": "Read raw shop from the shared search MongoDB (RawShopRepository)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-wpc-front-v2",
      "service": "skello-app-front",
      "kind": "service",
      "label": "svcWorkloadPlanV2Client",
      "path": "apps/vue-app/src/shared/utils/clients/svc_workload_plans_v2_client.js",
      "description": "V2 client (Mongo-backed API); the V1 svc_workload_client still ships alongside it"
    },
    {
      "id": "cu-wpc-controller-v1",
      "service": "svc-workload-plan",
      "kind": "controller",
      "label": "WorkloadPlanController#indexAction",
      "path": "src/Controller/WorkloadPlan/WorkloadPlanController.ts",
      "description": "V1 read surface — findAllByPosteIdsAndDateRange on the DynamoDB-backed manager (still live during the migration)"
    },
    {
      "id": "cu-wpc-controller-v2",
      "service": "svc-workload-plan",
      "kind": "controller",
      "label": "WorkloadPlanV2Controller#index",
      "path": "src/Controller/WorkloadPlan/WorkloadPlanV2Controller.ts",
      "description": "V2 read surface over the Mongo store"
    },
    {
      "id": "cu-wpc-manager-v2",
      "service": "svc-workload-plan",
      "kind": "manager",
      "label": "WorkloadPlanManagerV2#get",
      "path": "src/Manager/WorkloadPlanManagerV2.ts",
      "description": "Loads plans + rules from Mongo, fetches the shop from svc-search's raw collections, and generates dynamic rules from predictive KPIs when rule metrics are present"
    },
    {
      "id": "cu-wpc-kpis-manager",
      "service": "svc-workload-plan",
      "kind": "manager",
      "label": "KpisManager",
      "path": "src/Manager/KpisManager.ts",
      "description": "fetchAllKpis through the svc-kpis-v2 SDK repository"
    },
    {
      "id": "cu-wpc-rules-controller",
      "service": "svc-workload-plan",
      "kind": "controller",
      "label": "WorkloadRuleV2Controller",
      "path": "src/Controller/WorkloadRule/WorkloadRuleV2Controller.ts",
      "description": "Staffing-rule CRUD read by the forecasting view (WorkloadRuleManager on Mongo)"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-wpc-front-v2",
      "label": "open workload forecasting view",
      "mode": "sync"
    },
    {
      "from": "cu-wpc-front-v2",
      "to": "svc-workload-plan",
      "label": "GET /v2/workload-plans + /v2/workload-rules",
      "mode": "sync"
    },
    {
      "from": "svc-workload-plan",
      "to": "cu-wpc-controller-v2",
      "label": "API GW → WorkloadPlanV2Controller#index",
      "mode": "sync"
    },
    {
      "from": "svc-workload-plan",
      "to": "cu-wpc-controller-v1",
      "label": "API GW → WorkloadPlanController#indexAction",
      "mode": "sync",
      "condition": "V1 client path (migration in flight)"
    },
    {
      "from": "cu-wpc-controller-v2",
      "to": "cu-wpc-manager-v2",
      "label": "WorkloadPlanManagerV2#get",
      "mode": "sync"
    },
    {
      "from": "cu-wpc-controller-v1",
      "to": "dynamo-workload-v1",
      "label": "WorkloadPlanManager findAllByPosteIdsAndDateRange",
      "mode": "sync",
      "crud": ["read"]
    },
    {
      "from": "cu-wpc-manager-v2",
      "to": "mongo-workload",
      "label": "plans + rules",
      "mode": "sync",
      "crud": ["read"]
    },
    {
      "from": "cu-wpc-manager-v2",
      "to": "svc-search",
      "label": "RawShopRepository (shared Mongo)",
      "mode": "sync"
    },
    {
      "from": "cu-wpc-manager-v2",
      "to": "cu-wpc-kpis-manager",
      "label": "KpisManager getKpis (predictive, 15m)",
      "mode": "sync",
      "condition": "rules reference metrics; degrades if KPI service unavailable"
    },
    {
      "from": "cu-wpc-kpis-manager",
      "to": "svc-kpis-v2",
      "label": "fetchAllKpis (svc-kpis-v2-sdk)",
      "mode": "sync"
    }
  ],
  "infraNodes": [
    {
      "id": "mongo-workload",
      "type": "mongodb",
      "label": "svc-workload-plan MongoDB",
      "description": "V2 store — workload plans and rules"
    },
    {
      "id": "dynamo-workload-v1",
      "type": "dynamodb",
      "label": "workloadPlan (V1)",
      "description": "Legacy store still serving V1 reads during the Mongo migration"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-workload-plan",
      "to": "mongo-workload",
      "label": "plans + rules",
      "crud": ["read"]
    },
    {
      "from": "svc-workload-plan",
      "to": "dynamo-workload-v1",
      "label": "V1 reads",
      "crud": ["read"]
    }
  ]
})

export default workload_plan_consultation
