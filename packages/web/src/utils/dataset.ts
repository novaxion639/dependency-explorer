import type { ConnectivityMap, ListenerSurface, ResourceNote, ResourceRelation, ResourceSurface } from '@dependency-explorer/data'

export interface Dataset {
  map: ConnectivityMap
  resources: ResourceSurface
  listeners: ListenerSurface
  relations: ResourceRelation[]
  notes: Record<string, ResourceNote>
}
