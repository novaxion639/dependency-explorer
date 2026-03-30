export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface EndpointParam {
  name: string
  in: 'path' | 'query' | 'body' | 'header'
  type: string
  required: boolean
  description: string
}

export interface AwsCall {
  type: DatabaseType
  name: string
}

export interface ServiceEndpoint {
  id: string
  path: string
  method: HttpMethod
  description: string
  useCase: string
  params: EndpointParam[]
  response: Record<string, string>
  awsCalls?: AwsCall[]
}

export type DatabaseType = 'postgresql' | 'redis' | 'dynamodb' | 'elasticsearch' | 'mongodb' | 's3' | 'sqs' | 'sns' | 'kinesis' | 'lambda' | 'cdc'

export interface ServiceDatabase {
  type: DatabaseType
  name: string
  description: string
}

export interface ConnectivityService {
  name: string
  type: 'typescript-microservice' | 'rails-microservice' | 'rails-monolith' | 'vue-frontend' | 'react-native'
  description: string
  endpoints: ServiceEndpoint[]
  databases?: ServiceDatabase[]
}

export interface ServiceConnection {
  from: string
  to: string
  sdkPackage: string
  description: string
  /** IDs of endpoints on the `to` service that `from` typically calls */
  usedEndpoints: string[]
}

export interface ServiceFlowStep {
  from: string
  to: string
  action: string
}

export interface FlowInfraNode {
  id: string
  type: DatabaseType
  label: string
  description?: string
}

export interface FlowInfraEdge {
  from: string  // service name OR infra node id
  to: string    // infra node id
  label?: string
}

export interface ServiceFlow {
  id: string
  name: string
  description: string
  steps: ServiceFlowStep[]
  infraNodes?: FlowInfraNode[]
  infraEdges?: FlowInfraEdge[]
}

export interface ConnectivityMap {
  services: ConnectivityService[]
  connections: ServiceConnection[]
  flows: ServiceFlow[]
}
