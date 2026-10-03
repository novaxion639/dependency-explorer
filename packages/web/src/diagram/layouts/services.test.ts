import { describe, it, expect } from 'vitest'
import { connectivityMap as map, resourceSurface } from '@dependency-explorer/data'
import { layoutProblems } from '../layoutProblems'
import { SUBJECT_ID } from './ids'
import { serviceByArea } from './serviceByArea'
import { serviceByHow } from './serviceByHow'

const resources = resourceSurface.resources
const WORST = ['skello-app', 'svc-communications-v2', 'svc-kpis-v2']

describe('service layouts', () => {
  it('lay out every service soundly in both modes', () => {
    for (const s of map.services) {
      expect(layoutProblems(serviceByHow(map, resources, s.name)), `how ${s.name}`).toEqual([])
      expect(layoutProblems(serviceByArea(map, resources, s.name)), `area ${s.name}`).toEqual([])
    }
  })
  it('fit the worst-case services on one 1440×900 screen, never one line per neighbour', () => {
    for (const name of WORST) {
      const neighbours = new Set(map.connections.flatMap(c => (c.from === name ? [c.to] : c.to === name ? [c.from] : []))).size
      for (const m of [serviceByHow(map, resources, name), serviceByArea(map, resources, name)]) {
        expect(m.width, m.id).toBeLessThanOrEqual(1440)
        expect(m.height, m.id).toBeLessThanOrEqual(900)
        expect(m.edges.length, m.id).toBeLessThan(neighbours)
      }
    }
  })
  it('groups skello-app by how they talk, its own stores inside its card and no other stores', () => {
    const m = serviceByHow(map, resources, 'skello-app')
    expect(m.groups.map(g => g.label)).toEqual(['Clients · call it · 3', 'Services · call it · 13', 'Calls · 16', 'Notifies (SNS) · 4', 'Copies its data (CDC) · 14'])
    const subject = m.nodes.find(n => n.id === SUBJECT_ID)
    expect(subject?.stores.map(s => s.resource)).toEqual(['pg:skello_production', 'redis:skelloApp-valkey', 'ddb:svcUsers'])
    expect(m.nodes.filter(n => n.id !== SUBJECT_ID).every(n => n.stores.length === 0)).toBe(true)
  })
  it('groups skello-app neighbours by product area with direction marks', () => {
    const m = serviceByArea(map, resources, 'skello-app')
    const card = (label: string) => m.nodes.find(n => n.label === label)?.detail ?? []
    expect(card('Clients')).toContain('skello-app-front ←')
    expect(card('Counters & labour law')).toContain('svc-trackers ⇄')
    expect(card('Analytics & dashboards')).toContain('svc-kpis ⇠')
    expect(m.nodes.length).toBeLessThanOrEqual(9)
    expect(m.edges.every(e => !e.directed && e.from === SUBJECT_ID)).toBe(true)
  })
})
