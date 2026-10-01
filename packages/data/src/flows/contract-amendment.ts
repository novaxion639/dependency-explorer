import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// P2 coverage arc, traced 2026-07-20 (parallel repo trace). Amendment =
// contract-hours change; NO esignature/DPAE involvement (verified absent).
const contract_amendment: ServiceFlow = ServiceFlowSchema.parse({
  "id": "contract-amendment",
  "name": "Contract Amendment",
  "description": "A manager amends an employee's contract hours (temporary with ends_at, permanent, or cyclic via team schedules). Hard-gated by the shop feature 'contracts_amendments' (IllegalOperation otherwise). CreateService is NOT transactional — it hand-rolls compensation: if the conditional svc-employees annualization sync fails, it destroys the new amendment and restores the previous amendment's ends_at. A permanent amendment auto-closes the previous overlapping non-cyclic one (before_create end_previous_amendment). after_commit fans out three async effects: PlanningHoursData reset (counter/payroll hours), user.touch cache bust, and the contracts-timeline cache rebuild that microservices read. Cyclic amendments bulk-edit through a single transactional upsert_all. Activity reaches svc-events only under FEATUREDEV_SVC_EVENTS_WRITE.",
  "trigger": { "actor": "manager", "role": "can_create_amendment (Pundit on highest_license)" },
  "links": [
    { "to": "employee-onboarding", "kind": "domain-related", "note": "shares PlanningHoursData recompute, contracts-timeline cache rebuild and the ActivityJob → svc-events audit path" }
  ],
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST /v3/api/users/:user_id/contracts/:contract_id/amendments (CreateAmendmentModal → Vuex createAmendment)"
    },
    {
      "from": "skello-app",
      "to": "svc-employees",
      "action": "Annualization-config sync (Microservices::EmployeeService PUT — only when config present, FF-gated params)"
    },
    {
      "from": "skello-app",
      "to": "svc-events",
      "action": "Activity event via ActivityJob → EventService POST /events (FF FEATUREDEV_SVC_EVENTS_WRITE)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-ca-modal",
      "service": "skello-app-front",
      "kind": "component",
      "label": "CreateAmendmentModal",
      "path": "apps/vue-app/src/users/pages/contracts/components/FullContract/Amendments/CreateAmendmentModal/index.vue",
      "description": "Amendment creation modal on the employee contract page — creates temporary/permanent amendments (cyclic ones bulk-edit elsewhere)"
    },
    {
      "id": "cu-ca-store",
      "service": "skello-app-front",
      "kind": "client",
      "label": "createAmendment (amendments store)",
      "path": "apps/vue-app/src/shared/store/modules/employees/amendments.js",
      "description": "Vuex action POSTing the amendments endpoint"
    },
    {
      "id": "cu-ca-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::Users::Contracts::AmendmentsController",
      "path": "app/controllers/v3/api/users/contracts/amendments_controller.rb",
      "description": "create/destroy/bulk_update/index — hard-gated by shop feature 'contracts_amendments'; annualization params only under FEATUREDEV_CANARY_ANNUALIZATION_AMENDMENT_CONFIG"
    },
    {
      "id": "cu-ca-create-service",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::Amendments::CreateService",
      "path": "app/services/v3/amendments/create_service.rb",
      "description": "Builds+saves the amendment, syncs annualization, enqueues recompute — NOT transactional; compensates annualization failure by destroying the amendment and restoring the prior ends_at"
    },
    {
      "id": "cu-ca-bulk-service",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::TeamSchedules::AmendmentBulkUpdateService",
      "path": "app/services/v3/team_schedules/amendment_bulk_update_service.rb",
      "description": "Transactional upsert_all of cyclic amendments (team_schedule_id + schedule_week_index)"
    },
    {
      "id": "cu-ca-model",
      "service": "skello-app",
      "kind": "model-callback",
      "label": "amendment callbacks (end_previous_amendment, after_commit fan-out)",
      "path": "app/models/contract_amendment.rb",
      "description": "before_create end_previous_amendment (permanent only — closes the overlapping non-cyclic predecessor); after_commit: planning-hours reset, user.touch cache bust, contracts-timeline rebuild"
    },
    {
      "id": "cu-ca-employee-client",
      "service": "skello-app",
      "kind": "client",
      "label": "Microservices::EmployeeService",
      "path": "app/services/microservices/employee_service.rb",
      "description": "HTTParty client to svc-employees — synchronous; raises Skello::InternalError on non-2xx (triggers the compensation path)"
    },
    {
      "id": "cu-ca-activity-job",
      "service": "skello-app",
      "kind": "job",
      "label": "ActivityJob",
      "path": "app/jobs/activity_job.rb",
      "description": "Sidekiq audit job (key create_amendment) — svc-events write FF-gated + Notification.create_for unless super_admin"
    },
    {
      "id": "cu-ca-event-client",
      "service": "skello-app",
      "kind": "client",
      "label": "Microservices::EventService",
      "path": "app/services/microservices/event_service.rb",
      "description": "HTTP POST to svc-events /events (X-Api-Key)"
    },
    {
      "id": "cu-ca-recalc-job",
      "service": "skello-app",
      "kind": "job",
      "label": "PlanningHoursDatas::RecalculJobForOneUser",
      "path": "app/jobs/planning_hours_datas/recalcul_job_for_one_user.rb",
      "description": "Recomputes the user's weekly planning hours; early-returns when the user has no planning_hours_datas"
    },
    {
      "id": "cu-ca-reset-job",
      "service": "skello-app",
      "kind": "job",
      "label": "ResetPlanningHourDatasJob",
      "path": "app/jobs/reset_planning_hour_datas_job.rb",
      "description": "hours_counter queue — PlanningHoursDatas::Resetter from the amendment start (minus 1 week for the Resetter's start_date > semantics)"
    },
    {
      "id": "cu-ca-timeline-job",
      "service": "skello-app",
      "kind": "job",
      "label": "Users::CacheContractsTimelineJob",
      "path": "app/jobs/users/cache_contracts_timeline_job.rb",
      "description": "Rebuilds CachedContractsTimeline — the contract view microservices consume"
    }
  ],
  "codeEdges": [
    { "from": "cu-ca-modal", "to": "cu-ca-store", "label": "createAmendment", "mode": "sync" },
    { "from": "cu-ca-store", "to": "skello-app", "label": "POST amendments endpoint", "mode": "sync" },
    { "from": "skello-app", "to": "cu-ca-controller", "label": "amendments routes", "mode": "sync" },
    {
      "from": "cu-ca-controller", "to": "cu-ca-create-service", "label": "V3::Amendments::CreateService.run!",
      "mode": "sync", "condition": "shop.feature_enabled?('contracts_amendments') — IllegalOperation otherwise",
      "flags": [{ "name": "FEATUREDEV_CANARY_ANNUALIZATION_AMENDMENT_CONFIG", "kind": "dev" }]
    },
    {
      "from": "cu-ca-controller", "to": "cu-ca-bulk-service", "label": "AmendmentBulkUpdateService (bulk_update)",
      "mode": "sync", "condition": "cyclic amendments only", "inTransaction": true, "crud": ["create", "update"]
    },
    {
      "from": "cu-ca-create-service", "to": "cu-ca-model", "label": "build + save (end_previous_amendment fires)",
      "mode": "sync", "crud": ["create", "update"]
    },
    {
      "from": "cu-ca-create-service", "to": "cu-ca-employee-client", "label": "annualization sync (compensated on failure)",
      "mode": "sync", "condition": "annualization_config present (params FF-gated at the controller)"
    },
    { "from": "cu-ca-employee-client", "to": "svc-employees", "label": "PUT annualization-config", "mode": "sync" },
    { "from": "cu-ca-create-service", "to": "cu-ca-activity-job", "label": "perform_later (create_amendment)", "mode": "async-job" },
    {
      "from": "cu-ca-activity-job", "to": "cu-ca-event-client", "label": "EventService.create",
      "mode": "sync", "condition": "FF: FEATUREDEV_SVC_EVENTS_WRITE",
      "flags": [{ "name": "FEATUREDEV_SVC_EVENTS_WRITE", "kind": "dev" }]
    },
    { "from": "cu-ca-event-client", "to": "svc-events", "label": "POST /events", "mode": "sync" },
    { "from": "cu-ca-create-service", "to": "cu-ca-recalc-job", "label": "recompute planning hours", "mode": "async-job" },
    { "from": "cu-ca-model", "to": "cu-ca-reset-job", "label": "after_commit update_planning_hours_data", "mode": "async-job" },
    { "from": "cu-ca-model", "to": "cu-ca-timeline-job", "label": "after_commit preprocess_for_ms", "mode": "async-job" },
    { "from": "cu-ca-model", "to": "pg-skello-amendments", "label": "contract_amendments + prior ends_at", "mode": "sync", "crud": ["create", "update"] },
    { "from": "cu-ca-reset-job", "to": "pg-skello-amendments", "label": "planning_hours_datas reset", "mode": "sync", "crud": ["update"] }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-amendments",
      "type": "postgresql",
      "label": "skello_production — contract_amendments, planning_hours_datas, cached_contracts_timelines",
      "description": "Amendment rows + recomputed counters + the contracts-timeline cache microservices read"
    },
    {
      "id": "redis-skello-amendments",
      "type": "redis",
      "label": "skello-redis",
      "description": "Sidekiq broker (default + hours_counter queues)"
    }
  ],
  "infraEdges": [
    { "from": "skello-app", "to": "pg-skello-amendments", "label": "amendments + counters", "crud": ["create", "update"] },
    { "from": "skello-app", "to": "redis-skello-amendments", "label": "enqueue recompute/audit jobs" }
  ]
})

export default contract_amendment
