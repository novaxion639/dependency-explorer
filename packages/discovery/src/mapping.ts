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
  // pure computation/UI libraries pulled by the mobile apps — no service behind them
  '@skelloapp/expo-sso-lib': 'SSO helper library (mobile)',
  '@skelloapp/i18n-lib': 'i18n library',
  '@skelloapp/skello-absences': 'absence computation library (runs in-client)',
  '@skelloapp/skello-annualization': 'annualization counter library (runs in-client)',
  '@skelloapp/skello-planning-helper': 'planning duration helpers (runs in-client)',
  '@skelloapp/skello-shifts-alerts': 'compliance alert computation library (runs in-browser)',
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
  // the mobile flavor of the punch SDK — same service as svc-punch-sdk
  '@skelloapp/svc-punch-js': 'svc-punch',
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

// ── Stream source resolution ─────────────────────────────────────────────────
// A stream event source means the consumer reads ANOTHER system's data — the
// edge points at whoever produces the stream. Identities are kinesis stream
// names (template parts stripped) or serverless/SSM parameter names.
//
//   'skello-app' — the DMS CDC backbone: skelloapp-bus and every *fullload*
//                  stream replicate the monolith's PostgreSQL outward.
//   'self'      — the service's own DynamoDB table stream / own kinesis
//                  stream (internal wiring, not a service-to-service edge).
//   another service — parameter names spelling out a foreign service
//                  (posDynamoDBStream, streamSvcDocumentsEsignature).
//   null        — unresolvable: surfaced in the report, never guessed.

const normalizeStreamToken = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export function streamSourceService(
  stream: string,
  consumerRepo: string,
  serviceNames: Iterable<string>,
): string | 'self' | null {
  if (/skelloapp-bus/i.test(stream) || /full.?load/i.test(stream) || /SKELLO_APP.*CDC/i.test(stream)) {
    return 'skello-app'
  }
  // arn:…:stream/${serviceName}-${stage} — the service's own kinesis stream
  if (/\$\{serviceName\}/.test(stream)) return 'self'

  const norm = normalizeStreamToken(stream)
  const consumerToken = normalizeStreamToken(consumerRepo.replace(/^svc-/, ''))
  if (norm.includes(consumerToken)) return 'self'

  // Foreign-service parameter names — longest service token wins (kpis-v2 over kpis)
  let best: string | null = null
  let bestLen = 0
  for (const name of serviceNames) {
    if (name === consumerRepo) continue
    const token = normalizeStreamToken(name.replace(/^svc-/, ''))
    if (token.length >= 3 && norm.includes(token) && token.length > bestLen) {
      best = name
      bestLen = token.length
    }
  }
  if (best) return best

  // Engine-only DynamoDB names (streamDynamodb, dynamoDBStream…) are the
  // service's own table stream — verified across docs-v2/hris/enrollment/pos.
  if (/^(stream)?dynamodb(stream)?$/.test(norm)) return 'self'
  return null
}

// ── Terraform repo resolution ────────────────────────────────────────────────
// The estate is one `<service>-tf` repo per service; a few names drifted.
export const TF_REPO_SERVICE_OVERRIDES: Record<string, string> = {
  'svc-kpi-tf': 'svc-kpis',
  'websocket-tf': 'svc-websockets',
  'svc-superadmin-tf': 'superadmin',
}

export function tfRepoToService(tfRepo: string): string {
  return TF_REPO_SERVICE_OVERRIDES[tfRepo] ?? tfRepo.replace(/-tf$/, '')
}

// Subdirectories of microservices/ acting as clients of a single service.
export const RAILS_CLIENT_DIR_TARGETS: Record<string, string | null> = {
  'communications_v2': 'svc-communications-v2',
  'punch': 'svc-punch',
  'automatic_planning': null, // svc-automatic-scheduling vs legacy solver path — confirm first
  'generate_documents': null,
  'transformers': null, // serializers, not a client
}
