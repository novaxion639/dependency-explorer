import { buildContextLanes, getServiceLane, type ConnectivityMap, type ProductArea } from '@dependency-explorer/data'
import { aggregateEdges } from '../aggregate'
import { linesHeight } from '../geometry'
import { ALL_RENDERERS, type DiagramGroup, type DiagramModel, type DiagramNode, type NodeKind } from '../model'
import { areaId, CLIENTS_ID, MONOLITH_ID, PLATFORM_ID, serviceId } from './ids'

const FONT = 12
const CHIP_W = 192
const CHIP_H = linesHeight(1, FONT)
const CHIP_GAP = 6
const HEAD = 26
const PAD = 8
const GAP = 16
const AREA_W = CHIP_W + 2 * PAD
const GRID_COLS = 5
const MONO_W = 168

function chip(name: string, x: number, y: number, kind: NodeKind): DiagramNode {
  return { id: serviceId(name), kind, label: name, detail: [], stores: [], fontSize: FONT, x, y, w: CHIP_W, h: CHIP_H, ref: { type: 'service', name } }
}

function areaHeight(services: number): number {
  return HEAD + Math.max(services, 1) * (CHIP_H + CHIP_GAP) - CHIP_GAP + PAD
}

function placeArea(area: ProductArea, services: string[], x: number, y: number, nodes: DiagramNode[]): DiagramGroup {
  services.forEach((s, i) => nodes.push(chip(s, x + PAD, y + HEAD + i * (CHIP_H + CHIP_GAP), 'service')))
  return { id: areaId(area.id), kind: 'group', label: area.name, members: services.map(serviceId), fontSize: FONT, x, y, w: AREA_W, h: areaHeight(services.length), ref: { type: 'area', id: area.id } }
}

export function overviewMap(map: ConnectivityMap, spotlight: string | null): DiagramModel {
  const areas = map.areas ?? []
  const ctx = buildContextLanes(map)
  const servicesOf = new Map(ctx.lanes.map(l => [l.area.id, l.services]))
  const product = areas.filter(a => a.kind === 'product')
  const platform = areas.filter(a => a.kind === 'platform')
  const nodes: DiagramNode[] = []
  const groups: DiagramGroup[] = []

  const width = Math.max(MONO_W + GAP + GRID_COLS * (AREA_W + GAP) - GAP, platform.length * (AREA_W + GAP) - GAP + 2 * PAD)
  const clientsH = HEAD + CHIP_H + PAD
  ctx.clients.forEach((s, i) => nodes.push(chip(s, PAD + i * (CHIP_W + CHIP_GAP), HEAD, 'client')))
  groups.push({ id: CLIENTS_ID, kind: 'band', label: 'Clients', members: ctx.clients.map(serviceId), fontSize: FONT, x: 0, y: 0, w: width, h: clientsH })

  const gridY = clientsH + GAP
  let rowY = gridY
  for (let start = 0; start < product.length; start += GRID_COLS) {
    const row = product.slice(start, start + GRID_COLS)
    row.forEach((area, col) => groups.push(placeArea(area, servicesOf.get(area.id) ?? [], MONO_W + GAP + col * (AREA_W + GAP), rowY, nodes)))
    rowY += Math.max(...row.map(a => areaHeight((servicesOf.get(a.id) ?? []).length))) + GAP
  }
  const gridH = rowY - GAP - gridY
  const hosted = product.filter(a => a.codeLocations.some(l => ctx.monolith.includes(l.repo))).length
  ctx.monolith.forEach((s, i) => nodes.push({
    id: serviceId(s), kind: 'monolith', label: s, detail: [`hosts ${hosted} areas`], stores: [], fontSize: FONT,
    x: PAD, y: gridY + HEAD + i * (linesHeight(2, FONT) + CHIP_GAP), w: MONO_W - 2 * PAD, h: linesHeight(2, FONT), ref: { type: 'service', name: s },
  }))
  groups.push({ id: MONOLITH_ID, kind: 'band', label: 'Monolith', members: ctx.monolith.map(serviceId), fontSize: FONT, x: 0, y: gridY, w: MONO_W, h: gridH })

  const platformY = gridY + gridH + GAP
  const platformInner = Math.max(...platform.map(a => areaHeight((servicesOf.get(a.id) ?? []).length)))
  platform.forEach((area, i) => groups.push(placeArea(area, servicesOf.get(area.id) ?? [], PAD + i * (AREA_W + GAP), platformY + HEAD, nodes)))
  groups.push({ id: PLATFORM_ID, kind: 'band', label: 'Platform', members: platform.map(a => areaId(a.id)), fontSize: FONT, x: 0, y: platformY, w: width, h: HEAD + platformInner + PAD })

  const groupOf = (service: string): string | null => {
    if (ctx.clients.includes(service)) {
      return CLIENTS_ID
    }
    if (ctx.monolith.includes(service)) {
      return MONOLITH_ID
    }
    const lane = getServiceLane(service, areas)
    return lane ? areaId(lane.id) : null
  }
  const edges = spotlight
    ? aggregateEdges(map.connections, c => {
      const from = groupOf(c.from)
      const to = groupOf(c.to)
      return from && to && (from === spotlight || to === spotlight) ? [from, to] : null
    })
    : []
  groups.sort((a, b) => b.w * b.h - a.w * a.h)
  return {
    id: 'overview', title: 'Microservices by product area', width, height: platformY + HEAD + platformInner + PAD,
    nodes, groups, edges, renderers: ALL_RENDERERS,
  }
}
