import { flowChapters } from '@dependency-explorer/data'
import { EDGE_LIST_SEP, edgeKey, type UrlState } from '../hooks/useUrlState'
import { areaById, fileIndex, flagRegistry, map, resourceIds } from './dataIndexes'

export function validateUrlState(st: UrlState): UrlState {
  const serviceNames = new Set(map.services.map(s => s.name))
  const next = { ...st }
  let notFound: UrlState['notFound'] = null
  if (next.s && !serviceNames.has(next.s)) {
    notFound = { param: 's', value: next.s }
    next.s = null
  }
  if (next.area && !areaById.has(next.area)) {
    notFound = notFound ?? { param: 'area', value: next.area }
    next.area = null
  }
  if (next.term && !areaById.get(next.area ?? '')?.glossary.some(g => g.term === next.term)) {
    notFound = notFound ?? { param: 'term', value: next.term }
    next.term = null
  }
  if (next.flow && !map.flows.some(f => f.id === next.flow)) {
    notFound = notFound ?? { param: 'flow', value: next.flow }
    next.flow = null
  }
  const openFlow = next.flow ? map.flows.find(f => f.id === next.flow) : undefined
  if (!openFlow) {
    next.unit = null
    next.chapter = null
  } else {
    const ids = new Set([...(openFlow.codeUnits ?? []).map(u => u.id), ...(openFlow.infraNodes ?? []).map(n => n.id)])
    if (next.unit && !ids.has(next.unit)) {
      next.unit = null
    }
    if (next.chapter && next.chapter > flowChapters(openFlow).chapters.length) {
      next.chapter = null
    }
  }
  if (next.resource && !resourceIds.has(next.resource)) {
    notFound = notFound ?? { param: 'resource', value: next.resource }
    next.resource = null
  }
  if (next.team && !(map.teams ?? []).some(t => t.id === next.team)) {
    next.team = null
  }
  if (next.flows && !serviceNames.has(next.flows)) {
    next.flows = null
  }
  if (next.flag && !flagRegistry.has(next.flag)) {
    next.flag = null
  }
  if (next.file && !fileIndex.has(next.file)) {
    next.file = null
  }
  if (!next.flow) {
    next.detail = null
  }
  if (next.drawer && !serviceNames.has(next.drawer)) {
    next.drawer = null
  }
  if (next.edge) {
    const known = new Set(map.connections.map(c => edgeKey(c.from, c.to, c.protocol)))
    if (!next.edge.split(EDGE_LIST_SEP).every(k => known.has(k))) {
      next.edge = null
    }
  }
  if (next.ep) {
    const drawerSvc = next.drawer ? map.services.find(s => s.name === next.drawer) : null
    if (!drawerSvc?.endpoints.some(e => e.id === next.ep)) {
      next.ep = null
    }
  }
  if (next.blast && !serviceNames.has(next.blast) && !resourceIds.has(next.blast)) {
    next.blast = null
  }
  if (next.page === 'microservices' && next.s === 'skello-app') {
    next.page = 'monolith'
  }
  if (next.page === 'monolith' && next.s && next.s !== 'skello-app') {
    next.page = 'microservices'
  }
  next.notFound = notFound
  return next
}
