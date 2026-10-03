import { areasForFile, getAreaFlows, getServiceLane, type ConnectivityMap, type MonolithRoute, type ProductArea, type Resource } from '@dependency-explorer/data'
import { MONOLITH } from '../diagram/layouts/monolith'

export interface AreaSliceData {
  area: ProductArea
  controllers: Array<{ name: string; routes: number }>
  tables: Array<{ id: string; name: string }>
  calls: string[]
  flows: Array<{ id: string; name: string }>
}

export function areaSlice(map: ConnectivityMap, routes: MonolithRoute[], resources: Resource[], areaId: string): AreaSliceData | null {
  const areas = map.areas ?? []
  const area = areas.find(a => a.id === areaId)
  if (!area) {
    return null
  }
  const claims = (file: string) => areasForFile(MONOLITH, file, areas).some(a => a.id === areaId)
  const counts = new Map<string, number>()
  for (const r of routes) {
    if (claims(r.controllerFile)) {
      counts.set(r.controller, (counts.get(r.controller) ?? 0) + 1)
    }
  }
  const own = new Set(map.services.filter(s => getServiceLane(s.name, areas)?.id === areaId).map(s => s.name))
  return {
    area,
    controllers: [...counts].map(([name, n]) => ({ name, routes: n })).sort((a, b) => b.routes - a.routes || a.name.localeCompare(b.name)),
    tables: resources.filter(r => r.owner === MONOLITH && r.model && claims(r.model.file)).map(r => ({ id: r.id, name: r.name })).sort((a, b) => a.name.localeCompare(b.name)),
    calls: [...new Set(map.connections.filter(c => own.has(c.from) && !own.has(c.to)).map(c => c.to))].sort(),
    flows: getAreaFlows(area, map.flows, areas).map(f => ({ id: f.id, name: f.name })),
  }
}
