import { describe, it, expect } from 'vitest'
import { connectivityMap, monolithRoutes } from '@dependency-explorer/data'
import type { MonolithRoute } from '@dependency-explorer/data'
import { buildFileIndex } from './fileIndex'

const SHIFTS_CONTROLLER = 'app/controllers/v3/api/plannings/shifts_controller.rb'

describe('buildFileIndex', () => {
  it('lists the routes a monolith controller serves beside the flows that traverse it', () => {
    const routes: MonolithRoute[] = [
      { verb: 'POST', path: '/v3/api/plannings/shifts', controller: 'v3/api/plannings/shifts', action: 'create', controllerFile: SHIFTS_CONTROLLER },
      { verb: 'GET', path: '/health', controller: 'health', action: 'app_health', controllerFile: 'app/controllers/health_controller.rb' },
    ]
    const index = buildFileIndex(connectivityMap, routes)
    const shifts = index.get(`skello-app/${SHIFTS_CONTROLLER}`)
    expect(shifts?.routes).toEqual(['POST /v3/api/plannings/shifts'])
    expect(shifts?.flows.some(f => f.id === 'shift-creation')).toBe(true)
    expect(index.get('skello-app/app/controllers/health_controller.rb')?.flows).toEqual([])
  })

  it('covers every generated monolith route', () => {
    const index = buildFileIndex(connectivityMap, monolithRoutes)
    const served = [...index.values()].reduce((n, e) => n + e.routes.length, 0)
    expect(served).toBe(monolithRoutes.length)
  })
})
