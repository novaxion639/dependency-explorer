import { allResourceRelations, connectivityMap, monolithRoutes, resourceSurface, type ServiceConnection } from '@dependency-explorer/data'
import { EDGE_LIST_SEP, edgeKey } from '../hooks/useUrlState'
import { buildSearchIndex } from '../utils/searchIndex'
import { buildFlagRegistry } from '../utils/flagRegistry'
import { buildFileIndex } from '../utils/fileIndex'

export const map = connectivityMap
export const searchIndex = buildSearchIndex(map, monolithRoutes, resourceSurface.resources)
export const flagRegistry = buildFlagRegistry(map)
export const fileIndex = buildFileIndex(map, monolithRoutes, allResourceRelations)
export const resourceIds = new Set(resourceSurface.resources.map(r => r.id))
export const areaById = new Map((map.areas ?? []).map(a => [a.id, a]))

export function connectionsFor(list: string): ServiceConnection[] {
  const keys = new Set(list.split(EDGE_LIST_SEP))
  return map.connections.filter(c => keys.has(edgeKey(c.from, c.to, c.protocol)))
}
