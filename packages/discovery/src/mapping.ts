/**
 * Classification tables for discovery — kept small and explicit.
 *
 * A wrong mapping fabricates an architecture fact, so anything ambiguous
 * stays unmapped (null) and is surfaced in the drift report for a human
 * decision — never guessed (see docs/flow-authoring-guide.md §1).
 */

// @skelloapp packages that are shared libraries or external platforms —
// their presence in package.json is NOT a service-to-service connection.
export const IGNORED_SDKS: Record<string, string> = {
  '@skelloapp/aws-sdk-lib': 'shared AWS helper library',
  '@skelloapp/skello-auth-client': 'JWT auth client library (used by every service)',
  '@skelloapp/data-platform-svc-ingestion-sdk': 'data-platform ingestion — external to this map',
}

// SDKs that are pure data contracts over a SHARED DATABASE — importing them
// means direct collection access (Mongo over VPC), never an HTTP call.
// Verified 2026-06-10: svc-search-sdk exports only Raw*Dto/Entity attributes
// (no HTTP client, no connection code); consumers connect with their own
// Mongo client using SSM svcSearch/MONGO_DB_* parameters.
export const MONGO_CONTRACT_SDKS = new Set(['@skelloapp/svc-search-sdk'])

// SDKs whose target does not follow the `@skelloapp/svc-<name>-sdk` convention.
export const SDK_SERVICE_OVERRIDES: Record<string, string> = {
  '@skelloapp/skello-app-sdk': 'skello-app',
  // Verified 2026-06-15: AnalyticsDashboard.vue instantiates SkelloAnalyticsClient(skelloApiUrl) — the monolith, not a separate analytics service.
  '@skelloapp/skello-analytics-client': 'skello-app',
  '@skelloapp/svc-esignature-sdk': 'svc-documents-esignature',
  '@skelloapp/workload-plan-sdk': 'svc-workload-plan',
}

/** Resolve an SDK package to a service name; null = ignored library/external. */
export function sdkToServiceName(sdkPkg: string): string | null {
  if (sdkPkg in IGNORED_SDKS) return null
  const override = SDK_SERVICE_OVERRIDES[sdkPkg]
  if (override) return override
  const name = sdkPkg.replace('@skelloapp/', '').replace(/-sdk$/, '').replace(/-client$/, '')
  return name.startsWith('svc-') ? name : `svc-${name}`
}

// Frontend service hostnames that don't match a service name 1:1.
// null = known legacy host (v1 service), deliberately not in the map.
export const FRONTEND_HOST_ALIASES: Record<string, string | null> = {
  'svc-esignature': 'svc-documents-esignature', // host/SDK drift — repo is svc-documents-esignature
  'svc-documents': null, // documents v1 — legacy
}

// GitHub teams that never own services: Terraform-generated PR-approval
// squads and functional/org-wide teams. Excluded from the "unmapped product
// team" report — only food-named product teams (teams.ts) own services.
export function isStructuralGithubTeam(slug: string): boolean {
  if (/^@skelloapp\/squad-/.test(slug)) return true
  return ['team-dev', 'team-infra', 'team-qa', 'team-tech', 'team-pm', 'team-tpm',
    'team-marketing', 'team-revops', 'team-stratops', 'team-support',
    'team-data', 'team-data-analytics']
    .some(t => slug === `@skelloapp/${t}`)
}

// Rails monolith outbound clients: app/services/microservices/*.rb → target.
// null = recognised client file whose target is ambiguous — reported, not guessed.
export const RAILS_CLIENT_TARGETS: Record<string, string | null> = {
  'billing_automation_service.rb': 'svc-billing-automation',
  'documents_v2_service.rb': 'svc-documents-v2',
  'employee_service.rb': 'svc-employees',
  'esignature_service.rb': 'svc-documents-esignature',
  'event_service.rb': 'svc-events',
  'hiring_service.rb': 'svc-hiring',
  'feature_flag_service.rb': 'svc-feature-flags',
  'labour_law_service.rb': 'svc-labour-laws',
  'modularisation_service.rb': 'svc-modularisation',
  'report_service.rb': 'svc-reports',
  'request_service.rb': 'svc-requests',
  'shops_service.rb': 'svc-shops',
  'trackers_service.rb': 'svc-trackers',
  'user_service.rb': 'svc-users',
  // Ambiguous — needs a human decision before mapping:
  'activity_log_service.rb': null,
  'brain_service.rb': null,
  'communications.rb': null, // legacy v1 or svc-communications-v2?
  'documents_service.rb': null, // legacy documents v1?
  'generate_documents_service.rb': null,
}

// Subdirectories of microservices/ acting as clients of a single service.
export const RAILS_CLIENT_DIR_TARGETS: Record<string, string | null> = {
  'communications_v2': 'svc-communications-v2',
  'punch': 'svc-punch',
  'automatic_planning': null, // svc-automatic-scheduling vs legacy solver path — confirm first
  'generate_documents': null,
  'transformers': null, // serializers, not a client
}
