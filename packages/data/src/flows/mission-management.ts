import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// P2 coverage arc, traced 2026-07-20. Mission CRUD lives in svc-shops — the
// monolith only exports the xlsx report and purges on shop teardown.
const mission_management: ServiceFlow = ServiceFlowSchema.parse({
  "id": "mission-management",
  "name": "Mission Management",
  "description": "A manager runs temp-work missions. CRUD lives ENTIRELY in svc-shops (MissionController → MissionManager → its own Mongo `missions` collection) — the monolith's missions controller only exports the xlsx report (shifts from its Postgres, mission name fetched back from svc-shops) and purges missions on shop teardown (Shops::PurgeShopMissionsJob). The details view's 'additional infos' fan out across three services: svc-shops reads the shop timezone from svc-search's shared rawShop collection (hard dependency — missing timezone throws) and the mission's shifts from the shared shifts collection, computes planned/worked/ongoing hours in-memory against now-in-shop-timezone, and asks svc-employees for active-contract wages to flag the first employee missing hourly_wage_with_costs (null/0 counts as missing). The KPIs tab (mounted with the details page via v-show, so it fetches whichever tab is shown) asks svc-kpis-v2 for the mission's real cost (POST /kpis, mission_salary_mass_productive_with_costs, period all): svc-kpis-v2 reads the shop's opening and closing hours from svc-search's rawShop (404 when missing), the mission's shifts started before today's closing from svc-search's shifts, and prices them at hourly_wage_with_costs from svc-employees active contracts — computed on demand, nothing stored. Bulk CSV import batches at 100; the xlsx export batches at 500.",
  "trigger": { "actor": "manager", "role": "can_read_missions / can_download_mission_report (monolith) · MissionAction permissions (svc-shops); shop gated by is_missions_enabled" },
  "primaryArea": "missions",
  "chapters": [
    { "title": "A manager opens missions", "summary": "In a shop with missions enabled, the front sends mission reads and edits straight to svc-shops.", "refs": ["cu-mm-front-store", "cu-mm-front-client"] },
    { "title": "Each action is permission-checked", "summary": "svc-shops checks the manager's mission permission for every action before passing it on.", "refs": ["cu-mm-controller", "cu-mm-manager"] },
    { "title": "Missions are saved in svc-shops", "summary": "Missions live only in svc-shops' own collection, where they are created, read, updated and deleted; CSV imports go by 100.", "refs": ["cu-mm-repo", "mongo-shops-missions"] },
    { "title": "The shop timezone is looked up", "summary": "For the details view, the shop timezone is read from svc-search's shared database; a missing one fails the request.", "refs": ["cu-mm-manager", "cu-mm-rawshop-repo", "mongo-search-shared"] },
    { "title": "The mission's shifts are read", "summary": "The mission's shifts that have an employee are read from svc-search's shared shifts collection.", "refs": ["cu-mm-shift-repo", "mongo-search-shared"] },
    { "title": "Mission hours are sorted", "summary": "In memory, hours are classed as planned, worked or ongoing against the current time in the shop's timezone.", "refs": ["cu-mm-hours"] },
    { "title": "Missing wages are flagged", "summary": "svc-employees returns active contracts; the first employee whose hourly wage with costs is empty or zero is flagged.", "refs": ["cu-mm-wage", "svc-employees"] },
    { "title": "The KPIs tab asks for mission cost", "summary": "When the details open, the KPIs tab asks svc-kpis-v2 for the mission's real cost, open to managers who can see the shop's KPIs or employees.", "refs": ["cu-mm-kpis-tab", "cu-mm-front-store", "cu-mm-kpis-client", "cu-mm-kpis-controller"] },
    { "title": "Mission cost is computed", "summary": "svc-kpis-v2 reads shop hours and the mission's shifts started before today's closing from svc-search, then prices them with svc-employees wages.", "refs": ["cu-mm-kpis-manager", "cu-mm-kpis-rawshop-repo", "cu-mm-kpis-shift-manager", "cu-mm-kpis-cost", "cu-mm-kpis-shift-repo", "mongo-kpis-search-shared", "svc-employees"] },
    { "title": "A manager exports the report", "summary": "The front asks skello-app for the xlsx report, open only to managers allowed to download it.", "refs": ["cu-mm-front-store", "cu-mm-mono-controller"] },
    { "title": "The report is built", "summary": "skello-app reads the mission's shifts from its own database, fetches the name from svc-shops and writes the xlsx by 500.", "refs": ["cu-mm-mono-gen", "cu-mm-mono-exporter"] },
    { "title": "Shop teardown purges missions", "summary": "When a shop is torn down, a skello-app job calls svc-shops to delete the shop's missions.", "refs": ["cu-mm-purge-job", "cu-mm-controller"] }
  ],
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
    },
    {
      "from": "skello-app-front",
      "to": "svc-kpis-v2",
      "action": "POST /kpis — mission_salary_mass_productive_with_costs, period all, types real (KPIs tab mission cost)"
    },
    {
      "from": "svc-kpis-v2",
      "to": "svc-search",
      "action": "Shared-Mongo reads — rawShop opening/closing/timezone + mission shifts started before today's closing"
    },
    {
      "from": "svc-kpis-v2",
      "to": "svc-employees",
      "action": "POST /v1/employees/active-contracts — hourly_wage_with_costs per shift user and date"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-mm-front-store",
      "service": "skello-app-front",
      "kind": "service",
      "label": "missions store (MissionsRepository calls)",
      "path": "apps/vue-app/src/shared/store/modules/missions/missions.js",
      "description": "fetch/create/update/additionalInfos via svcShopsClient.mission; fetchMissionCost via svcKpisV2Client (KPIs tab); export via monolith endpoint"
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
    },
    {
      "id": "cu-mm-kpis-tab",
      "service": "skello-app-front",
      "kind": "component",
      "label": "MissionKpiTab",
      "path": "apps/vue-app/src/missions/shared/components/KpisTab.vue",
      "description": "KPIs tab — mounted() dispatches fetchMissionCost (v-show in Details.vue, so it fires on every details render); margin = billed costs − cost; missing-wage banner from additionalInfos"
    },
    {
      "id": "cu-mm-kpis-client",
      "service": "skello-app-front",
      "kind": "client",
      "label": "KpisRepository",
      "path": "apps/vue-app/src/shared/utils/clients/svc_kpis_v2_client.js",
      "description": "svc-kpis-v2-sdk KpisRepository on VUE_APP_SVC_KPIS_V2_API_URL, 30 s timeout"
    },
    {
      "id": "cu-mm-kpis-controller",
      "service": "svc-kpis-v2",
      "kind": "controller",
      "label": "KpisController",
      "path": "src/Controller/KpisController.ts",
      "description": "readAll (POST /kpis) — KpisPermission.grantAccess per shop, SupportedKpisValidator whitelist"
    },
    {
      "id": "cu-mm-kpis-manager",
      "service": "svc-kpis-v2",
      "kind": "manager",
      "label": "KpisManager",
      "path": "src/Manager/KpisManager.ts",
      "description": "getAllKpis — shop hours from rawShop (404 when the shop or its opening/closing time is missing); window = startAt + opening to endAt + closing; real branch only"
    },
    {
      "id": "cu-mm-kpis-shift-manager",
      "service": "svc-kpis-v2",
      "kind": "manager",
      "label": "KpiShiftManager",
      "path": "src/Manager/KpiShift/KpiShiftManager.ts",
      "description": "Routes mission_salary_mass_productive_with_costs to the mission-cost processor when missionIds is set"
    },
    {
      "id": "cu-mm-kpis-cost",
      "service": "svc-kpis-v2",
      "kind": "service",
      "label": "KpiShiftMissionCostProcessor",
      "path": "src/Manager/KpiShift/Processor/KpiShiftMissionCostProcessor.ts",
      "description": "Σ hourly_wage_with_costs × duration/3600 over the mission's shifts started before today's closing (shop timezone), rounded to 2 decimals; shifts without a user or matched contract add nothing; 400 unless period all"
    },
    {
      "id": "cu-mm-kpis-shift-repo",
      "service": "svc-kpis-v2",
      "kind": "service",
      "label": "MissionCostShiftRepository",
      "path": "src/Repository/Mongo/MissionCostShiftRepository.ts",
      "description": "Reads svc-search's shared shifts — {missionId, startsAt < cutoff}"
    },
    {
      "id": "cu-mm-kpis-rawshop-repo",
      "service": "svc-kpis-v2",
      "kind": "service",
      "label": "RawShopRepository",
      "path": "src/Repository/Mongo/RawShopRepository.ts",
      "description": "Reads svc-search's shared rawShop by skelloId — opening/closing time and timezone"
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
    { "from": "cu-mm-purge-job", "to": "svc-shops", "label": "purge_shop_missions", "mode": "sync", "crud": ["delete"] },
    { "from": "cu-mm-kpis-tab", "to": "cu-mm-front-store", "label": "fetchMissionCost (on mount)", "mode": "sync" },
    { "from": "cu-mm-front-store", "to": "cu-mm-kpis-client", "label": "kpisRepository.fetchAllKpis", "mode": "sync" },
    { "from": "cu-mm-kpis-client", "to": "svc-kpis-v2", "label": "POST /kpis (mission cost)", "mode": "sync", "contractRefs": ["POST /kpis"], "auth": { "tokenType": "jwt", "authorizer": "SkelloLambdaAuthorizerJwtOrApiKey", "gate": "KpisPermission.grantAccess" } },
    { "from": "svc-kpis-v2", "to": "cu-mm-kpis-controller", "label": "readAllKpis route", "mode": "sync" },
    { "from": "cu-mm-kpis-controller", "to": "cu-mm-kpis-manager", "label": "getAllKpis", "mode": "sync" },
    { "from": "cu-mm-kpis-manager", "to": "cu-mm-kpis-rawshop-repo", "label": "shop hours + timezone (404 when missing)", "mode": "sync", "crud": ["read"] },
    { "from": "cu-mm-kpis-manager", "to": "cu-mm-kpis-shift-manager", "label": "computeKpis (real)", "mode": "sync" },
    { "from": "cu-mm-kpis-shift-manager", "to": "cu-mm-kpis-cost", "label": "mission cost", "mode": "sync", "condition": "missionIds set" },
    { "from": "cu-mm-kpis-cost", "to": "cu-mm-kpis-shift-repo", "label": "past mission shifts", "mode": "sync", "crud": ["read"] },
    { "from": "cu-mm-kpis-cost", "to": "svc-employees", "label": "active contracts (hourly wage)", "mode": "sync" },
    { "from": "cu-mm-kpis-shift-repo", "to": "mongo-kpis-search-shared", "label": "shifts reads", "mode": "sync", "crud": ["read"] },
    { "from": "cu-mm-kpis-rawshop-repo", "to": "mongo-kpis-search-shared", "label": "rawShop reads", "mode": "sync", "crud": ["read"] }
  ],
  "infraNodes": [
    { "id": "mongo-shops-missions", "type": "mongodb", "label": "svc-shops `missions` collection", "resources": ["mongo:svc-shops"], "description": "Mission entity storage (own DB)" },
    { "id": "mongo-search-shared", "type": "mongodb", "label": "svc-search shared Mongo — shifts + rawShop", "resources": ["mongo:svc-search"], "description": "Read-only shared-database coupling (the existing verified svc-shops→svc-search edge)" },
    { "id": "mongo-kpis-search-shared", "type": "mongodb", "label": "svc-search shared Mongo — shifts + rawShop", "resources": ["mongo:svc-search"], "description": "svc-kpis-v2's read-only access to svc-search's database — mission shifts and shop hours for the mission cost" }
  ],
  "infraEdges": [
    { "from": "svc-shops", "to": "mongo-shops-missions", "label": "mission CRUD", "crud": ["create", "read", "update", "delete"] },
    { "from": "svc-shops", "to": "mongo-search-shared", "label": "shared reads", "crud": ["read"] },
    { "from": "svc-kpis-v2", "to": "mongo-kpis-search-shared", "label": "shared reads", "crud": ["read"] }
  ]
})

export default mission_management
