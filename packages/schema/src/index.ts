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
export const ProtocolSchema = z.enum(['rest', 'sqs', 'sns', 'kinesis', 'cdc', 'webhook', 'grpc', 'mongodb', 'postgresql'])

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

export const ConnectivityServiceSchema = z.object({
  name: z.string(),
  type: ServiceTypeSchema,
  description: z.string(),
  endpoints: z.array(ServiceEndpointSchema),
  databases: z.array(ServiceDatabaseSchema).optional(),
  teamId: z.string().optional(),
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
})

// ── Flow code layer ──────────────────────────────────────────────────────────
// Optional intra-service detail: the controllers, service objects, managers,
// jobs and model-callback groups a flow traverses INSIDE a service (typically
// the monolith). Humans author it from code reading; the flow checker verifies
// every `path` exists and every edge's callee is referenced from its caller's
// file, so this layer cannot silently drift (same doctrine as connections).

export const FlowCodeUnitKindSchema = z.enum([
  'controller', 'service', 'manager', 'job', 'model-callback',
])

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
export type ConnectivityService = z.infer<typeof ConnectivityServiceSchema>
export type ServiceConnection = z.infer<typeof ServiceConnectionSchema>
export type ServiceFlowStep = z.infer<typeof ServiceFlowStepSchema>
export type FlowInfraNode = z.infer<typeof FlowInfraNodeSchema>
export type FlowInfraEdge = z.infer<typeof FlowInfraEdgeSchema>
export type FlowCodeUnit = z.infer<typeof FlowCodeUnitSchema>
export type FlowCodeEdge = z.infer<typeof FlowCodeEdgeSchema>
export type ServiceFlow = z.infer<typeof ServiceFlowSchema>
export type Team = z.infer<typeof TeamSchema>
export type Domain = z.infer<typeof DomainSchema>
export type ConnectivityMap = z.infer<typeof ConnectivityMapSchema>
