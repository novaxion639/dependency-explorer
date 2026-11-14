import { getServiceLane, type ConnectivityMap, type ProductArea } from '@dependency-explorer/data'
import { aggregateEdges } from '../aggregate'
import { linesHeight, PAD_X, textWidth } from '../geometry'
import { ALL_RENDERERS, type DiagramEdge, type DiagramModel, type DiagramNode } from '../model'
import { areaId, serviceId } from './ids'

const FONT = 12
const CHIP_W = 192
const CHIP_H = linesHeight(1, FONT)
const CHIP_GAP = 6
const HEAD = 26
const PAD = 8
const COLUMN_GAP = 240

function chipWidth(labels: string[]): number {
  return Math.max(CHIP_W, ...labels.map(l => Math.ceil(textWidth(l, FONT)) + 2 * PAD_X))
}

function column(count: number): number {
  return Math.max(count, 1) * (CHIP_H + CHIP_GAP) - CHIP_GAP
}

export function areaCrossing(map: ConnectivityMap, area: ProductArea): DiagramModel {
  const areas = map.areas ?? []
  const laneOf = (service: string) => getServiceLane(service, areas)?.id
  const crossing = aggregateEdges(map.connections, c => {
    const from = laneOf(c.from)
    const to = laneOf(c.to)
    if (!from || !to || from === to) {
      return null
    }
    if (from === area.id) {
      return [serviceId(c.from), areaId(to)]
    }
    if (to === area.id) {
      return [areaId(from), serviceId(c.to)]
    }
    return null
  })
  const edges: DiagramEdge[] = crossing.map(({ ref: _connections, ...edge }) => edge)
  const ends = new Set(edges.flatMap(e => [e.from, e.to]))
  const services = map.services.map(s => s.name).filter(name => ends.has(serviceId(name))).sort()
  const others = areas.filter(a => ends.has(areaId(a.id))).sort((a, b) => a.name.localeCompare(b.name))

  const left = chipWidth(services)
  const right = chipWidth(others.map(o => o.name))
  const areaW = Math.max(left + 2 * PAD, Math.ceil(textWidth(area.name, FONT)) + 2 * PAD_X)
  const nodes: DiagramNode[] = [
    ...services.map((name, i): DiagramNode => ({
      id: serviceId(name), kind: 'service', label: name, detail: [], stores: [], fontSize: FONT,
      x: PAD, y: HEAD + i * (CHIP_H + CHIP_GAP), w: left, h: CHIP_H, ref: { type: 'service', name },
    })),
    ...others.map((other, i): DiagramNode => ({
      id: areaId(other.id), kind: 'area', label: other.name, detail: [], stores: [], fontSize: FONT,
      x: areaW + COLUMN_GAP, y: HEAD + i * (CHIP_H + CHIP_GAP), w: right, h: CHIP_H, ref: { type: 'area', id: other.id },
    })),
  ]
  const height = HEAD + Math.max(column(services.length), column(others.length)) + PAD
  return {
    id: `area-crossing:${area.id}`, title: `How ${area.name} connects to other areas`, width: areaW + COLUMN_GAP + right, height,
    nodes,
    groups: [{ id: areaId(area.id), kind: 'group', label: area.name, members: services.map(serviceId), fontSize: FONT, x: 0, y: 0, w: areaW, h: height }],
    edges, renderers: ALL_RENDERERS,
  }
}
