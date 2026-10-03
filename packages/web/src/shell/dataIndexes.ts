import { allResourceRelations, connectivityMap, monolithRoutes, resourceSurface } from '@dependency-explorer/data'
import { buildSearchIndex } from '../utils/searchIndex'
import { buildFlagRegistry } from '../utils/flagRegistry'
import { buildFileIndex } from '../utils/fileIndex'

export const map = connectivityMap
export const searchIndex = buildSearchIndex(map, monolithRoutes, resourceSurface.resources)
export const flagRegistry = buildFlagRegistry(map)
export const fileIndex = buildFileIndex(map, monolithRoutes, allResourceRelations)
export const resourceIds = new Set(resourceSurface.resources.map(r => r.id))
export const areaById = new Map((map.areas ?? []).map(a => [a.id, a]))
