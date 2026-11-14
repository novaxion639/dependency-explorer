import type { ConnectivityService, ServiceConnection, ServiceFlow } from '@dependency-explorer/data'
import { monolithRoutes, resourceSurface } from '@dependency-explorer/data'
import type { UrlState } from '../hooks/useUrlState'
import { areaSlice, type AreaSliceData } from '../utils/areaSlice'
import { connectionsFor, map } from './dataIndexes'

export type Panel =
  | { kind: 'unit'; flow: ServiceFlow; unit: string }
  | { kind: 'connections'; connections: ServiceConnection[] }
  | { kind: 'edge'; connection: ServiceConnection }
  | { kind: 'endpoints'; service: ConnectivityService; highlight: string | null }
  | { kind: 'slice'; slice: AreaSliceData }
  | { kind: 'none' }

export function panelFor(url: UrlState): Panel {
  const architecture = url.page === 'microservices' || url.page === 'monolith'
  const flow = url.page === 'flows' && url.flow ? map.flows.find(f => f.id === url.flow) : undefined
  if (flow && url.unit) {
    return { kind: 'unit', flow, unit: url.unit }
  }
  const connections = architecture && url.edge ? connectionsFor(url.edge) : []
  const [first] = connections
  if (connections.length > 1) {
    return { kind: 'connections', connections }
  }
  if (first) {
    return { kind: 'edge', connection: first }
  }
  const service = (architecture || url.page === 'flows') && url.drawer ? map.services.find(s => s.name === url.drawer) : undefined
  if (service) {
    return { kind: 'endpoints', service, highlight: url.ep }
  }
  const slice = architecture && url.area ? areaSlice(map, monolithRoutes, resourceSurface.resources, url.area) : null
  if (slice) {
    return { kind: 'slice', slice }
  }
  return { kind: 'none' }
}
