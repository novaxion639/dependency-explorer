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

export const ProtocolSchema = z.enum(['rest', 'sqs', 'sns', 'kinesis', 'cdc', 'webhook', 'grpc'])

export const AuthTypeSchema = z.enum(['jwt', 'api-key', 'internal', 'iam-role', 'none'])

export const CrudOperationSchema = z.enum(['create', 'read', 'update', 'delete'])

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
})

// ── Connection ────────────────────────────────────────────────────────────────

export const ServiceConnectionSchema = z.object({
  from: z.string(),
  to: z.string(),
  sdkPackage: z.string(),
  description: z.string(),
  usedEndpoints: z.array(z.string()),
  communicationType: CommunicationTypeSchema.optional(),
  protocol: ProtocolSchema.optional(),
  authType: AuthTypeSchema.optional(),
})

// ── Flow ──────────────────────────────────────────────────────────────────────

export const ServiceFlowStepSchema = z.object({
  from: z.string(),
  to: z.string(),
  action: z.string(),
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
})

// ── Team ─────────────────────────────────────────────────────────────────────

export const TeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  slackChannel: z.string().optional(),
  onCallUrl: z.string().optional(),
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
export type EndpointParam = z.infer<typeof EndpointParamSchema>
export type AwsCall = z.infer<typeof AwsCallSchema>
export type ServiceEndpoint = z.infer<typeof ServiceEndpointSchema>
export type ServiceDatabase = z.infer<typeof ServiceDatabaseSchema>
export type ConnectivityService = z.infer<typeof ConnectivityServiceSchema>
export type ServiceConnection = z.infer<typeof ServiceConnectionSchema>
export type ServiceFlowStep = z.infer<typeof ServiceFlowStepSchema>
export type FlowInfraNode = z.infer<typeof FlowInfraNodeSchema>
export type FlowInfraEdge = z.infer<typeof FlowInfraEdgeSchema>
export type ServiceFlow = z.infer<typeof ServiceFlowSchema>
export type Team = z.infer<typeof TeamSchema>
export type Domain = z.infer<typeof DomainSchema>
export type ConnectivityMap = z.infer<typeof ConnectivityMapSchema>
