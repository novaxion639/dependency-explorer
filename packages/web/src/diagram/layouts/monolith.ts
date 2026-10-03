import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy'
import { areasForFile, type ConnectivityMap, type MonolithRoute, type Resource } from '@dependency-explorer/data'
import { fitLabel, LINE_HEIGHT, PAD_Y } from '../geometry'
import type { DiagramModel, DiagramNode, DiagramRef, NodeKind } from '../model'
import { areaId } from './ids'

export const MONOLITH = 'skello-app'
const WIDTH = 1280
const HEIGHT = 760
const FONT = 14
const SMALL_AREA_FILES = 12

export interface AreaFacts {
  files: Record<string, Record<string, number>>
  coverage: Record<string, { mapped: number; total: number }>
}
export interface MonolithRow { areaId: string | null; name: string; files: number; routes: number; tables: number }

interface Block { id: string; kind: NodeKind; label: string; files: number; routes: number; tables: number; ref?: DiagramRef }
interface Datum { block?: Block; children?: Datum[] }

export function monolithRows(map: ConnectivityMap, routes: MonolithRoute[], resources: Resource[], facts: AreaFacts): MonolithRow[] {
  const areas = map.areas ?? []
  const routeAreas = routes.map(r => areasForFile(MONOLITH, r.controllerFile, areas).map(a => a.id))
  const tableAreas = resources.flatMap(r => (r.model && r.owner === MONOLITH ? [areasForFile(MONOLITH, r.model.file, areas).map(a => a.id)] : []))
  const rows = areas
    .map(area => ({
      areaId: area.id,
      name: area.name,
      files: Object.entries(facts.files[area.id] ?? {}).filter(([key]) => key.startsWith(`${MONOLITH}:`)).reduce((n, [, count]) => n + count, 0),
      routes: routeAreas.filter(ids => ids.includes(area.id)).length,
      tables: tableAreas.filter(ids => ids.includes(area.id)).length,
    }))
    .filter(r => r.files + r.routes + r.tables > 0)
    .sort((a, b) => b.files - a.files || a.name.localeCompare(b.name))
  const coverage = facts.coverage[MONOLITH] ?? { mapped: 0, total: 0 }
  return [...rows, {
    areaId: null,
    name: 'Not mapped yet',
    files: coverage.total - coverage.mapped,
    routes: routeAreas.filter(ids => !ids.length).length,
    tables: tableAreas.filter(ids => !ids.length).length,
  }]
}

function blockNode(block: Block, x: number, y: number, w: number, h: number): DiagramNode {
  const fit = Math.floor((h - 2 * PAD_Y) / (FONT * LINE_HEIGHT))
  const detail = [`${block.files} files`, `${block.routes} routes · ${block.tables} tables`]
    .slice(0, Math.max(0, fit - 1))
    .map(line => fitLabel(line, w, FONT))
    .filter(Boolean)
  return { id: block.id, kind: block.kind, label: fit >= 1 ? fitLabel(block.label, w, FONT) : '', detail, stores: [], fontSize: FONT, x, y, w, h, ...(block.ref ? { ref: block.ref } : {}) }
}

export function monolithTreemap(rows: MonolithRow[]): DiagramModel {
  const areaRows = rows.flatMap(r => (r.areaId !== null && r.files > 0 ? [{ ...r, areaId: r.areaId }] : []))
  const small = areaRows.filter(r => r.files < SMALL_AREA_FILES)
  const sum = (key: 'files' | 'routes' | 'tables') => small.reduce((n, r) => n + r[key], 0)
  const blocks: Block[] = [
    ...areaRows.filter(r => r.files >= SMALL_AREA_FILES).map((r): Block => ({ id: areaId(r.areaId), kind: 'area', label: r.name, files: r.files, routes: r.routes, tables: r.tables, ref: { type: 'area', id: r.areaId } })),
    ...(small.length ? [{ id: 'area:smaller', kind: 'summary' as const, label: `${small.length} smaller areas`, files: sum('files'), routes: sum('routes'), tables: sum('tables') }] : []),
    ...rows.filter(r => r.areaId === null).map((r): Block => ({ id: 'area:unmapped', kind: 'unmapped', label: r.name, files: r.files, routes: r.routes, tables: r.tables })),
  ]
  const root = hierarchy<Datum>({ children: blocks.map(block => ({ block })) })
    .sum(d => d.block?.files ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  const laid = treemap<Datum>().size([WIDTH, HEIGHT]).paddingInner(6).round(true).tile(treemapSquarify)(root)
  const nodes = laid.leaves().flatMap(leaf => (leaf.data.block ? [blockNode(leaf.data.block, leaf.x0, leaf.y0, leaf.x1 - leaf.x0, leaf.y1 - leaf.y0)] : []))
  return { id: 'monolith-treemap', title: 'skello-app by product area', width: WIDTH, height: HEIGHT, nodes, groups: [], edges: [], renderers: ['react-flow', 'svg'] }
}
