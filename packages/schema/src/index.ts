import { z } from 'zod'

// ── Primitives ────────────────────────────────────────────────────────────────

export const HttpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])

export const DatabaseTypeSchema = z.enum([
  'postgresql',
  'redis',
  'dynamodb',
  'elasticsearch',
  'mongodb',
  's3',
  'sqs',
  'sns',
  'kinesis',
  'lambda',
  'cdc',
  // on-device store (mobile/tablet offline-first queues)
  'sqlite',
])

export const ServiceTypeSchema = z.enum([
  'typescript-microservice',
  'rails-microservice',
  'rails-monolith',
  'vue-frontend',
  'react-native',
])

export const CommunicationTypeSchema = z.enum(['sync', 'async'])

// 'mongodb'/'postgresql' = direct shared-database access (no API between the services);
// the SDK, when present, is only the data contract over the shared collections/tables.
// 's3' = bucket-notification coupling: the consumer's lambda triggers on objects
// another service drops in a bucket (no API call either).
export const ProtocolSchema = z.enum(['rest', 'sqs', 'sns', 'kinesis', 'cdc', 'webhook', 'grpc', 'mongodb', 'postgresql', 's3'])

export const AuthTypeSchema = z.enum(['jwt', 'api-key', 'internal', 'iam-role', 'none'])

export const CrudOperationSchema = z.enum(['create', 'read', 'update', 'delete'])

// ── Provenance ────────────────────────────────────────────────────────────────
// Every discovered fact records where it came from and when it was last
// confirmed against code (ADR-0004). Entities without provenance are manual.

export const ProvenanceSchema = z.object({
  source: z.enum(['manual', 'discovered']),
  lastVerified: z.string().optional(),
  evidence: z.string().optional(),
})

// ── Endpoint ──────────────────────────────────────────────────────────────────

export const EndpointParamSchema = z.object({
  name: z.string(),
  in: z.enum(['path', 'query', 'body', 'header']),
  type: z.string(),
  required: z.boolean(),
  description: z.string(),
})

export const AwsCallSchema = z.object({
  type: DatabaseTypeSchema,
  name: z.string(),
})

export const ServiceEndpointSchema = z.object({
  id: z.string(),
  path: z.string(),
  method: HttpMethodSchema,
  description: z.string(),
  useCase: z.string(),
  params: z.array(EndpointParamSchema),
  response: z.record(z.string(), z.string()),
  awsCalls: z.array(AwsCallSchema).optional(),
  provenance: ProvenanceSchema.optional(),
})

// ── Service ───────────────────────────────────────────────────────────────────

export const ServiceDatabaseSchema = z.object({
  type: DatabaseTypeSchema,
  name: z.string(),
  description: z.string(),
})

// Scheduled invocation (EventBridge schedule events in serverless config) —
// recurring work a service performs with no caller on the map.
export const RecurringTaskSchema = z.object({
  name: z.string(),
  /** rate(…)/cron(…) expression(s); conditional configs join branches with " | " */
  schedule: z.string(),
  description: z.string().optional(),
  provenance: ProvenanceSchema.optional(),
})

export const ConnectivityServiceSchema = z.object({
  name: z.string(),
  type: ServiceTypeSchema,
  description: z.string(),
  endpoints: z.array(ServiceEndpointSchema),
  databases: z.array(ServiceDatabaseSchema).optional(),
  recurringTasks: z.array(RecurringTaskSchema).optional(),
  teamId: z.string().optional(),
  // Raw CODEOWNERS wildcard teams (discovery evidence behind teamId)
  githubTeams: z.array(z.string()).optional(),
  repoUrl: z.string().optional(),
  tags: z.array(z.string()).optional(),
  provenance: ProvenanceSchema.optional(),
})

// ── Connection ────────────────────────────────────────────────────────────────

export const ServiceConnectionSchema = z.object({
  from: z.string(),
  to: z.string(),
  sdkPackage: z.string(),
  description: z.string(),
  usedEndpoints: z.array(z.string()),
  // Explicit on every connection — never inferred from sdkPackage naming (ADR-0004)
  communicationType: CommunicationTypeSchema,
  protocol: ProtocolSchema,
  authType: AuthTypeSchema,
  provenance: ProvenanceSchema.optional(),
})

// ── Flow ──────────────────────────────────────────────────────────────────────

export const ServiceFlowStepSchema = z.object({
  from: z.string(),
  to: z.string(),
  action: z.string(),
  // Page-load flows: groups steps into ordered lanes ("initial paint", "lazy", "polling")
  phase: z.string().optional(),
  /** Domain rules governing this step (DomainRule ids) */
  ruleRefs: z.array(z.string()).optional(),
})

// ── Domain rules ─────────────────────────────────────────────────────────────
// Cross-flow business rules whose knowledge would otherwise rot in flow prose
// (day attribution, matching windows, platform divergences). The statement is
// human-owned meaning — never machine-verified; everything around it is
// checked: rule refs resolve (integrity tests), sourcePaths exist in the
// sibling repos (discovery scanner — the 📐 report section).

export const RulePlatformSchema = z.enum(['backend', 'monolith', 'web', 'mobile', 'tablet'])

export const DomainRuleDivergenceSchema = z.object({
  platform: RulePlatformSchema,
  /** How this platform implements (or deliberately deviates from) the rule */
  behavior: z.string(),
  /** Code unit carrying this platform's implementation (FlowCodeUnit id) */
  codeUnitRef: z.string().optional(),
})

export const DomainRuleSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** The rule itself — human-owned narrative */
  statement: z.string(),
  /** Code unit holding the authoritative implementation (FlowCodeUnit id) */
  sourceOfTruth: z.string().optional(),
  divergences: z.array(DomainRuleDivergenceSchema).optional(),
  /** "<repo>/<path>" source files behind the rule — existence checked by discovery */
  sourcePaths: z.array(z.string()).min(1),
  /**
   * sha256 of each sourcePath's content, stamped at authoring. The discovery
   * scanner recomputes them (📐): a mismatch flags the rule for re-review —
   * the human-owned statement stays human-owned, its currency machine-watched.
   */
  sourceHashes: z.array(z.object({
    path: z.string(),
    sha256: z.string().length(64),
  })).optional(),
})

// ── Flow code layer ──────────────────────────────────────────────────────────
// Optional intra-service detail: the controllers, service objects, managers,
// jobs and model-callback groups a flow traverses INSIDE a service (typically
// the monolith). Humans author it from code reading; the flow checker verifies
// every `path` exists and every edge's callee is referenced from its caller's
// file, so this layer cannot silently drift (same doctrine as connections).

export const FlowCodeUnitKindSchema = z.enum([
  'controller', 'service', 'manager', 'job', 'model-callback',
  // client-app units (web/mobile/tablet flows)
  'component', 'client',
])

// ── Feature-flag refs ────────────────────────────────────────────────────────
// Typed flag references on code units/edges. `kind` is determined by the
// wrapping helper at the call site — FeatureFlagHelper.can_access? = product
// (sector/country gate), dev_flag_activated? = dev (canary by shop/org/user) —
// and is AUTHORED here, never inferred from the name (prefix-less product
// flags exist). The discovery scanner verifies the name appears literally in
// the owning unit's source (🚩); the flag → flows registry is derived at
// build time, never authored. Rollout state is runtime data — Phase 4 overlay.

export const FeatureFlagRefSchema = z.object({
  name: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  kind: z.enum(['product', 'dev']),
  /** Canary granularity when known — "shop", "organisation", "user" */
  scope: z.string().optional(),
})

export const FlowCodeUnitSchema = z.object({
  id: z.string(),
  /** Service this unit lives in (must match a flow participant, e.g. "skello-app") */
  service: z.string(),
  kind: FlowCodeUnitKindSchema,
  /** Display name, usually the Ruby/TS constant — "V3::Shifts::CreateService" */
  label: z.string(),
  /** Repo-relative file path — verified to exist by the flow checker */
  path: z.string().optional(),
  description: z.string().optional(),
  /** Domain rules this unit implements or mirrors (DomainRule ids) */
  ruleRefs: z.array(z.string()).optional(),
  /** Flags gating this unit's behavior — name verified in the unit's source (🚩) */
  flags: z.array(FeatureFlagRefSchema).optional(),
})

// ── Auth & permission context ────────────────────────────────────────────────
// Who can trigger a flow, and what authenticates each hop. `gate` is a
// permission predicate whose literal must appear in the edge's unit sources
// (🔐); `authorizer` is a named gateway authorizer verified against extracted
// serverless facts; `authAbsent` records routes with no gateway authorizer
// (auth enforced in-lambda or genuinely open) — absence is representable,
// never inferred. Token-LIFECYCLE facts (e.g. a deliberately-reusable stale
// device token) have no home here and stay prose — a named schema boundary.

export const FlowTriggerSchema = z.object({
  /** Who initiates the flow — "manager", "employee", "system (cron)", "prospect" */
  actor: z.string(),
  /** License/permission context when known */
  role: z.string().optional(),
})

export const AuthRefSchema = z.object({
  tokenType: AuthTypeSchema.optional(),
  /** Permission predicate — literal verified in the edge's unit sources (🔐) */
  gate: z.string().optional(),
  /** Named gateway authorizer — verified against the target's serverless config (🔐) */
  authorizer: z.string().optional(),
  /** No gateway authorizer on the target route(s) — auth is in-lambda or absent */
  authAbsent: z.literal('no-authorizer-configured').optional(),
})

// ── Failure & resilience (async edges) ───────────────────────────────────────
// What happens when an async hop fails. dlq/queue/retryPolicy are FACTS,
// verified against the target service's serverless/Terraform config by the
// 🧯 discovery section; onError is human-owned narrative; dlqAbsent is the
// honest waiver for hops with genuinely no DLQ wiring (HTTP fire-and-forget
// event posts, unwired queues) — representable truth instead of permanent red.
// `idempotent` is deliberately NOT a field: no extractor can verify it.

export const FlowFailureSchema = z.object({
  /** Queue/consumer the edge fires into, as named in the target's config (template parts stripped) */
  queue: z.string().optional(),
  /** DLQ wired to it — must match an extracted DLQ fact of the target service */
  dlq: z.string().optional(),
  /** e.g. "maxReceiveCount 3", "maximumRetryAttempts 5" */
  retryPolicy: z.string().optional(),
  /** No DLQ wiring exists for this hop — asserted, cross-checked against extraction */
  dlqAbsent: z.literal('confirmed-missing').optional(),
  /** Human-owned narrative: what a lost/failed message means for the user */
  onError: z.string().optional(),
})

export const FlowCodeEdgeSchema = z.object({
  /** Code-unit id, service name, or infra-node id */
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
  /** sync call, Sidekiq/queue job, or fire-and-forget event */
  mode: z.enum(['sync', 'async-job', 'async-event']).optional(),
  /** Guard under which the edge fires — "absence shifts only", "FF: FEATUREDEV_…" */
  condition: z.string().optional(),
  /** True when the call happens inside the surrounding DB transaction */
  inTransaction: z.boolean().optional(),
  crud: z.array(CrudOperationSchema).optional(),
  /** Flags gating this edge — name verified in the caller/callee source (🚩); `condition` stays for non-flag guards */
  flags: z.array(FeatureFlagRefSchema).optional(),
  /** Failure semantics of an async hop — facts verified by 🧯, narrative human-owned */
  failure: FlowFailureSchema.optional(),
  /** What authenticates this hop — gate/authorizer verified by 🔐 */
  auth: AuthRefSchema.optional(),
})

export const FlowInfraNodeSchema = z.object({
  id: z.string(),
  type: DatabaseTypeSchema,
  label: z.string(),
  description: z.string().optional(),
})

export const FlowInfraEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
  crud: z.array(CrudOperationSchema).optional(),
})

export const ServiceFlowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  /** Who can trigger this flow — enforced present by the integrity suite */
  trigger: FlowTriggerSchema.optional(),
  steps: z.array(ServiceFlowStepSchema),
  infraNodes: z.array(FlowInfraNodeSchema).optional(),
  infraEdges: z.array(FlowInfraEdgeSchema).optional(),
  codeUnits: z.array(FlowCodeUnitSchema).optional(),
  codeEdges: z.array(FlowCodeEdgeSchema).optional(),
})

// ── Team ─────────────────────────────────────────────────────────────────────

export const TeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  slackChannel: z.string().optional(),
  onCallUrl: z.string().optional(),
  // GitHub team slugs (from CODEOWNERS, e.g. "@skelloapp/squad-planning")
  // that map to this team — used by discovery to assign service ownership.
  githubTeams: z.array(z.string()).optional(),
})

// ── Domain (bounded context) ─────────────────────────────────────────────────

export const DomainSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  color: z.string(),
  serviceNames: z.array(z.string()),
  dataEntities: z.array(z.string()).optional(),
  publishedEvents: z.array(z.string()).optional(),
  consumedEvents: z.array(z.string()).optional(),
})

// ── Discovered overlay ────────────────────────────────────────────────────────
// Output of `pnpm discover --apply`: machine-verified facts merged into the
// manual dataset at load time (ADR-0004). Only contains facts about entities
// that already exist in the manual layer — new findings go to the drift
// report for human adoption via PR, never silently into the map.

export const DiscoveredOverlaySchema = z.object({
  generatedAt: z.string(),
  scannedRepos: z.array(z.string()),
  // serviceName → discovered facts
  services: z.record(z.string(), z.object({
    repoUrl: z.string().optional(),
    teamId: z.string().optional(),
    githubTeams: z.array(z.string()).optional(),
    recurringTasks: z.array(z.object({
      name: z.string(),
      schedule: z.string(),
      description: z.string().optional(),
    })).optional(),
  })),
  // "from→to" → verification stamp
  connections: z.record(z.string(), z.object({
    lastVerified: z.string(),
    evidence: z.string(),
  })),
  // "service#endpointId" → verification stamp (endpoint found in serverless config)
  endpoints: z.record(z.string(), z.object({
    lastVerified: z.string(),
    evidence: z.string(),
  })).optional(),
})

// ── Top-level map ─────────────────────────────────────────────────────────────

export const ConnectivityMapSchema = z.object({
  services: z.array(ConnectivityServiceSchema),
  connections: z.array(ServiceConnectionSchema),
  flows: z.array(ServiceFlowSchema),
  teams: z.array(TeamSchema).optional(),
  domains: z.array(DomainSchema).optional(),
  rules: z.array(DomainRuleSchema).optional(),
})

// ── Inferred types (replaces types-connectivity.ts) ──────────────────────────

export type HttpMethod = z.infer<typeof HttpMethodSchema>
export type DatabaseType = z.infer<typeof DatabaseTypeSchema>
export type ServiceType = z.infer<typeof ServiceTypeSchema>
export type CommunicationType = z.infer<typeof CommunicationTypeSchema>
export type Protocol = z.infer<typeof ProtocolSchema>
export type AuthType = z.infer<typeof AuthTypeSchema>
export type CrudOperation = z.infer<typeof CrudOperationSchema>
export type Provenance = z.infer<typeof ProvenanceSchema>
export type DiscoveredOverlay = z.infer<typeof DiscoveredOverlaySchema>
export type EndpointParam = z.infer<typeof EndpointParamSchema>
export type AwsCall = z.infer<typeof AwsCallSchema>
export type ServiceEndpoint = z.infer<typeof ServiceEndpointSchema>
export type ServiceDatabase = z.infer<typeof ServiceDatabaseSchema>
export type RecurringTask = z.infer<typeof RecurringTaskSchema>
export type ConnectivityService = z.infer<typeof ConnectivityServiceSchema>
export type ServiceConnection = z.infer<typeof ServiceConnectionSchema>
export type ServiceFlowStep = z.infer<typeof ServiceFlowStepSchema>
export type FlowInfraNode = z.infer<typeof FlowInfraNodeSchema>
export type FlowInfraEdge = z.infer<typeof FlowInfraEdgeSchema>
export type FlowCodeUnit = z.infer<typeof FlowCodeUnitSchema>
export type FlowCodeEdge = z.infer<typeof FlowCodeEdgeSchema>
export type ServiceFlow = z.infer<typeof ServiceFlowSchema>
export type FeatureFlagRef = z.infer<typeof FeatureFlagRefSchema>
export type FlowFailure = z.infer<typeof FlowFailureSchema>
export type FlowTrigger = z.infer<typeof FlowTriggerSchema>
export type AuthRef = z.infer<typeof AuthRefSchema>
export type RulePlatform = z.infer<typeof RulePlatformSchema>
export type DomainRuleDivergence = z.infer<typeof DomainRuleDivergenceSchema>
export type DomainRule = z.infer<typeof DomainRuleSchema>
export type Team = z.infer<typeof TeamSchema>
export type Domain = z.infer<typeof DomainSchema>
export type ConnectivityMap = z.infer<typeof ConnectivityMapSchema>
