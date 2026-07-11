import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Re-traced 2026-07-11 — the flow was mischaracterized: svc-bff serves NO
// dashboard read. POST /v1/kpis is the manual-KPI bulk UPDATE, dual-writing
// svc-kpis-v2 and the monolith in parallel (Promise.allSettled — the write
// side of the kpis migration); /v1/documents orchestrates document
// generation. The BFF's real aggregated LOAD is the month-planning initial
// load, which fans out to the monolith (config, calendar, shop catalog,
// rules) and svc-shops (missions). This flow now models that load, with the
// kpis dual-write as its documented sibling surface.
const bff_dashboard_load: ServiceFlow = ServiceFlowSchema.parse({
  "id": "bff-dashboard-load",
  "name": "BFF Month-Planning Initial Load",
  "description": "Opening the month planning view hits svc-bff's aggregated initial load (GET /v1/plannings/month/load): MonthPlanningInitialLoadManager fans out to the monolith over the skello-app SDK (planning config, planning calendar, shop catalog, shop rules, shop) and to svc-shops (missions), then assembles one response for the grid. The BFF's other surfaces are writes, not reads: POST /v1/kpis bulk-updates manual KPIs to BOTH svc-kpis-v2 and the monolith in parallel (the dual-write side of the KPIs migration), and /v1/documents orchestrates document generation on svc-documents-v2. (Re-traced 2026-07-11: the earlier 'dashboard KPIs compute + recent documents fetch' reading of these endpoints was wrong.)",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-bff",
      "action": "GET /v1/plannings/month/load — aggregated month-planning initial load"
    },
    {
      "from": "svc-bff",
      "to": "skello-app",
      "action": "Planning config + calendar + shop catalog + shop rules (skello-app SDK, parallel)"
    },
    {
      "from": "svc-bff",
      "to": "svc-shops",
      "action": "Missions for the shop (svc-shops SDK)"
    },
    {
      "from": "svc-bff",
      "to": "svc-kpis-v2",
      "action": "PATCH /kpis-manual/_bulk — manual-KPI dual-write (sibling surface POST /v1/kpis)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-bff-load-controller",
      "service": "svc-bff",
      "kind": "controller",
      "label": "MonthPlanningInitialLoadApiController",
      "path": "src/Controller/MonthPlanningInitialLoadApiController.ts",
      "description": "GET /v1/plannings/month/load — the aggregated read the month view opens with"
    },
    {
      "id": "cu-bff-load-manager",
      "service": "svc-bff",
      "kind": "manager",
      "label": "MonthPlanningInitialLoadManager",
      "path": "src/Manager/MonthPlanningInitialLoadManager.ts",
      "description": "Fans out to PlanningConfig/PlanningCalendar/ShopCatalog/ShopRules/Shop repositories (monolith) + MissionsRepository (svc-shops) and merges the response"
    },
    {
      "id": "cu-bff-kpis-controller",
      "service": "svc-bff",
      "kind": "controller",
      "label": "KpisApiController#bulkUpdateAction",
      "path": "src/Controller/KpisApiController.ts",
      "description": "POST /v1/kpis — the manual-KPI write surface (not a dashboard read)"
    },
    {
      "id": "cu-bff-kpis-manager",
      "service": "svc-bff",
      "kind": "manager",
      "label": "KpisManager#bulkUpdateKpis",
      "path": "src/Manager/KpisManager.ts",
      "description": "Dual write: svc-kpis-v2 updateKpisManual (batched by 500) and the monolith's SkelloAppKpisRepository, in parallel with aggregate failure reporting"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-bff-load-controller",
      "label": "open month planning view",
      "mode": "sync"
    },
    {
      "from": "cu-bff-load-controller",
      "to": "cu-bff-load-manager",
      "label": "MonthPlanningInitialLoadManager getInitialLoad",
      "mode": "sync"
    },
    {
      "from": "cu-bff-load-manager",
      "to": "skello-app",
      "label": "PlanningConfigRepository + PlanningCalendarRepository + ShopCatalogRepository + ShopRulesRepository (parallel)",
      "mode": "sync"
    },
    {
      "from": "cu-bff-load-manager",
      "to": "svc-shops",
      "label": "MissionsRepository (svc-shops-sdk)",
      "mode": "sync"
    },
    {
      "from": "skello-app-front",
      "to": "cu-bff-kpis-controller",
      "label": "save manual KPIs (planning KPIs row)",
      "mode": "sync"
    },
    {
      "from": "cu-bff-kpis-controller",
      "to": "cu-bff-kpis-manager",
      "label": "KpisManager bulk update",
      "mode": "sync"
    },
    {
      "from": "cu-bff-kpis-manager",
      "to": "svc-kpis-v2",
      "label": "updateKpisManual (batches of 500)",
      "mode": "sync"
    },
    {
      "from": "cu-bff-kpis-manager",
      "to": "skello-app",
      "label": "SkelloAppKpisRepository updateKpisManual",
      "mode": "sync"
    }
  ],
  "infraNodes": [
    {
      "id": "mongo-kpis",
      "type": "mongodb",
      "label": "SvcKpisV2 (VPC MongoDB)",
      "description": "KPI collections — kpisManual, settingActivityPrediction, settingsDisplayMetrics"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-kpis-v2",
      "to": "mongo-kpis",
      "label": "manual KPI writes",
      "crud": ["create", "update"]
    }
  ]
})

export default bff_dashboard_load
