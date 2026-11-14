import { describe, it, expect } from 'vitest'
import { connectivityMap as map, getCrossAreaEdges } from '@dependency-explorer/data'
import { layoutProblems } from '../layoutProblems'
import { areaCrossing } from './areaCrossing'
import { areaId, serviceId } from './ids'

const areas = map.areas ?? []
const timeAttendance = areas.find(a => a.id === 'time-attendance')

describe('areaCrossing', () => {
  it('lays out every area soundly', () => {
    const problems = areas.flatMap(a => layoutProblems(areaCrossing(map, a)).map(p => `${a.id}: ${p}`))

    expect(problems).toEqual([])
  })

  it('carries every connection that crosses the area boundary exactly once', () => {
    const counted = areas.map(a => areaCrossing(map, a).edges.reduce((n, e) => n + e.weight, 0))

    expect(counted).toEqual(areas.map(a => getCrossAreaEdges(a, map).reduce((n, e) => n + e.count, 0)))
  })

  it("puts the area's crossing services in its group and the other areas beside it", () => {
    const area = timeAttendance ?? areas[0]
    const crossing = area ? getCrossAreaEdges(area, map) : []

    const model = area ? areaCrossing(map, area) : null

    expect(model?.groups[0]?.members.sort()).toEqual([...new Set(crossing.map(e => serviceId(e.service)))].sort())
    expect(model?.nodes.filter(n => n.kind === 'area').map(n => n.id).sort()).toEqual([...new Set(crossing.map(e => areaId(e.otherArea)))].sort())
  })

  it('lets a node open its service or area, and keeps edges inert', () => {
    const model = timeAttendance ? areaCrossing(map, timeAttendance) : null

    expect(model?.nodes.map(n => n.ref?.type)).toEqual(model?.nodes.map(n => (n.kind === 'area' ? 'area' : 'service')))
    expect(model?.edges.length).toBeGreaterThan(0)
    expect(model?.edges.every(e => e.ref === undefined)).toBe(true)
  })
})
