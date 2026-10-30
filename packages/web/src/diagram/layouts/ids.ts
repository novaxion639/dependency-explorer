import { buildContextLanes, getServiceLane, type ConnectivityMap, type ProductArea } from '@dependency-explorer/data'

export const CLIENTS_ID = 'band:clients'
export const MONOLITH_ID = 'band:monolith'
export const PLATFORM_ID = 'band:platform'
export const SUBJECT_ID = 'subject'

export function areaId(id: string): string {
  return `area:${id}`
}

export function serviceId(name: string): string {
  return `svc:${name}`
}

export interface Home { id: string; label: string; lane?: ProductArea }

export function homeOf(map: ConnectivityMap): (service: string) => Home | null {
  const areas = map.areas ?? []
  const ctx = buildContextLanes(map)
  return service => {
    if (ctx.clients.includes(service)) {
      return { id: CLIENTS_ID, label: 'Clients' }
    }
    if (ctx.monolith.includes(service)) {
      return { id: MONOLITH_ID, label: 'Monolith' }
    }
    const lane = getServiceLane(service, areas)
    return lane ? { id: areaId(lane.id), label: lane.name, lane } : null
  }
}
