import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// P2 coverage arc, traced 2026-07-20. Mission CRUD lives in svc-shops — the
// monolith only exports the xlsx report and purges on shop teardown.
const mission_management: ServiceFlow = ServiceFlowSchema.parse({
  "id": "mission-management",
  "name": "Mission Management",
  "description": "A manager runs temp-work missions. CRUD lives ENTIRELY in svc-shops (MissionController → MissionManager → its own Mongo `missions` collection) — the monolith's missions controller only exports the xlsx report (shifts from its Postgres, mission name fetched back from svc-shops) and purges missions on shop teardown (Shops::PurgeShopMissionsJob). The details view's 'additional infos' fan out across three services: svc-shops reads the shop timezone from svc-search's shared rawShop collection (hard dependency — missing timezone throws) and the mission's shifts from the shared shifts collection, computes planned/worked/ongoing hours in-memory against now-in-shop-timezone, and asks svc-employees for active-contract wages to flag the first employee missing hourly_wage_with_costs (null/0 counts as missing). The KPIs tab reads svc-kpis-v2 separately. Bulk CSV import batches at 100; the xlsx export batches at 500.",
  "trigger": { "actor": "manager", "role": "can_read_missions / can_download_mission_report (monolith) · MissionAction permissions (svc-shops); shop gated by is_missions_enabled" },
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-shops",
      "action": "Mission CRUD + additionalInfos via svc-shops-sdk (svcShopsClient.mission)"
    },
    {
      "from": "svc-shops",
      "to": "svc-search",
      "action": "Shared-Mongo reads — rawShop timezone (required) + mission shifts"
    },
    {
      "from": "svc-shops",
      "to": "svc-employees",
      "action": "Active-contract wages for the missing-wage warning"
    },
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "GET /v3/api/missions/:id/export_report (xlsx)"
    },
    {
      "from": "skello-app",
      "to": "svc-shops",
      "action": "Mission name for the report (get_mission_by_id) · purge on shop teardown (PurgeShopMissionsJob)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-mm-front-store",
      "service": "skello-app-front",
      "kind": "service",
      "label": "missions store (MissionsRepository calls)",
      "path": "apps/vue-app/src/shared/store/modules/missions/missions.js",
      "description": "fetch/create/update/additionalInfos via svcShopsClient.mission; KPIs tab via svcKpisV2Client; export via monolith endpoint"
    },
    {
      "id": "cu-mm-front-client",
      "service": "skello-app-front",
      "kind": "client",
      "label": "svcShopsClient (missions)",
      "path": "apps/vue-app/src/shared/utils/clients/svc_shops_client.js",
      "description": "svc-shops-sdk client instance"
    },
    {
      "id": "cu-mm-controller",
      "service": "svc-shops",
      "kind": "controller",
      "label": "MissionController",
      "path": "src/Controller/MissionController.ts",
      "description": "create/getById/updateOne/getAllByShop/purge/upload/additionalInfos — MissionPermissions.checkAccess per action"
    },
    {
      "id": "cu-mm-manager",
      "service": "svc-shops",
      "kind": "manager",
      "label": "MissionManager",
      "path": "src/Manager/MissionManager.ts",
      "description": "CRUD + the additionalInfos fan-out (timezone → shifts → processors → wages)"
    },
    {
      "id": "cu-mm-repo",
      "service": "svc-shops",
      "kind": "service",
      "label": "MissionRepository",
      "path": "src/Repository/Mongo/MissionRepository.ts",
      "description": "CRUD on svc-shops' own `missions` collection"
    },
    {
      "id": "cu-mm-shift-repo",
      "service": "svc-shops",
      "kind": "service",
      "label": "ShiftRepository",
      "path": "src/Repository/Mongo/ShiftRepository.ts",
      "description": "Reads svc-search's shared `shifts` collection — {missionId, userId exists & non-null}"
    },
    {
      "id": "cu-mm-rawshop-repo",
      "service": "svc-shops",
      "kind": "service",
      "label": "RawShopRepository",
      "path": "src/Repository/Mongo/RawShopRepository.ts",
      "description": "Reads svc-search's shared `rawShop` collection for the shop timezone — BadRequestHttpError when absent"
    },
    {
      "id": "cu-mm-hours",
      "service": "svc-shops",
      "kind": "service",
      "label": "MissionHoursProcessor",
      "path": "src/Processor/MissionHoursProcessor.ts",
      "description": "In-memory planned/worked/ongoing classification vs now in the shop timezone"
    },
    {
      "id": "cu-mm-wage",
      "service": "svc-shops",
      "kind": "service",
      "label": "MissionWageProcessor",
      "path": "src/Processor/MissionWageProcessor.ts",
      "description": "First shift-user missing hourly_wage_with_costs (null/undefined/0 = missing) — via svc-employees active contracts"
    },
    {
      "id": "cu-mm-mono-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::MissionsController",
      "path": "app/controllers/v3/api/missions_controller.rb",
      "description": "export_report only — can_download_mission_report"
    },
    {
      "id": "cu-mm-mono-gen",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::Missions::MissionReportGeneratorService",
      "path": "app/services/v3/missions/mission_report_generator_service.rb",
      "description": "Report data — shifts from monolith Postgres (mission_id), mission name from svc-shops"
    },
    {
      "id": "cu-mm-mono-exporter",
      "service": "skello-app",
      "kind": "service",
      "label": "Mission::MissionExporter",
      "path": "app/exporters/mission/mission_exporter.rb",
      "description": "xlsx rendering, batched at 500"
    },
    {
      "id": "cu-mm-purge-job",
      "service": "skello-app",
      "kind": "job",
      "label": "Shops::PurgeShopMissionsJob",
      "path": "app/jobs/shops/purge_shop_missions_job.rb",
      "description": "Shop teardown — svc-shops purge endpoint via ShopsService"
    }
  ],
  "codeEdges": [
    { "from": "cu-mm-front-store", "to": "cu-mm-front-client", "label": "mission calls", "mode": "sync" },
    { "from": "cu-mm-front-client", "to": "svc-shops", "label": "mission CRUD + additionalInfos", "mode": "sync" },
    { "from": "svc-shops", "to": "cu-mm-controller", "label": "mission routes", "mode": "sync" },
    { "from": "cu-mm-controller", "to": "cu-mm-manager", "label": "per-action delegate (MissionPermissions first)", "mode": "sync" },
    { "from": "cu-mm-manager", "to": "cu-mm-repo", "label": "missions collection CRUD", "mode": "sync", "crud": ["create", "read", "update", "delete"] },
    { "from": "cu-mm-manager", "to": "cu-mm-rawshop-repo", "label": "shop timezone (throws when missing)", "mode": "sync", "crud": ["read"] },
    { "from": "cu-mm-manager", "to": "cu-mm-shift-repo", "label": "mission shifts", "mode": "sync", "crud": ["read"] },
    { "from": "cu-mm-manager", "to": "cu-mm-hours", "label": "hours classification", "mode": "sync" },
    { "from": "cu-mm-manager", "to": "cu-mm-wage", "label": "missing-wage detection", "mode": "sync" },
    { "from": "cu-mm-wage", "to": "svc-employees", "label": "active contracts (hourly wage)", "mode": "sync" },
    { "from": "cu-mm-repo", "to": "mongo-shops-missions", "label": "missions rows", "mode": "sync", "crud": ["create", "read", "update", "delete"] },
    { "from": "cu-mm-shift-repo", "to": "mongo-search-shared", "label": "shifts reads", "mode": "sync", "crud": ["read"] },
    { "from": "cu-mm-rawshop-repo", "to": "mongo-search-shared", "label": "rawShop reads", "mode": "sync", "crud": ["read"] },
    { "from": "cu-mm-front-store", "to": "skello-app", "label": "GET export_report", "mode": "sync" },
    { "from": "skello-app", "to": "cu-mm-mono-controller", "label": "missions route", "mode": "sync" },
    { "from": "cu-mm-mono-controller", "to": "cu-mm-mono-gen", "label": "MissionReportGeneratorService", "mode": "sync" },
    { "from": "cu-mm-mono-gen", "to": "cu-mm-mono-exporter", "label": "MissionExporter (batch 500)", "mode": "sync" },
    { "from": "cu-mm-mono-gen", "to": "svc-shops", "label": "get_mission_by_id", "mode": "sync" },
    { "from": "cu-mm-purge-job", "to": "svc-shops", "label": "purge_shop_missions", "mode": "sync", "crud": ["delete"] }
  ],
  "infraNodes": [
    { "id": "mongo-shops-missions", "type": "mongodb", "label": "svc-shops `missions` collection", "description": "Mission entity storage (own DB)" },
    { "id": "mongo-search-shared", "type": "mongodb", "label": "svc-search shared Mongo — shifts + rawShop", "description": "Read-only shared-database coupling (the existing verified svc-shops→svc-search edge)" }
  ],
  "infraEdges": [
    { "from": "svc-shops", "to": "mongo-shops-missions", "label": "mission CRUD", "crud": ["create", "read", "update", "delete"] },
    { "from": "svc-shops", "to": "mongo-search-shared", "label": "shared reads", "crud": ["read"] }
  ]
})

export default mission_management
