import { describe, it, expect } from 'vitest'
import * as os from 'node:os'
import { ConnectivityMapSchema } from '@dependency-explorer/schema'
import { checkFlowCodeLayers } from './flow-check'

const map = ConnectivityMapSchema.parse({
  services: [{ name: 'skello-app', type: 'rails-monolith', description: 'd', endpoints: [] }],
  connections: [],
  flows: [{
    id: 'f', name: 'F', description: 'd', steps: [],
    codeUnits: [
      { id: 'ok', service: 'skello-app', kind: 'controller', label: 'A', path: 'app/controllers/a_controller.rb' },
      { id: 'orphan', service: 'skello-app', kind: 'controller', label: 'B', path: 'app/controllers/b_controller.rb' },
      { id: 'abstract', service: 'skello-app', kind: 'controller', label: 'Base', path: 'app/controllers/v3/api/badgings/base_controller.rb' },
    ],
  }],
})

describe('controller units', () => {
  it('flag a skello-app controller that serves no route', () => {
    const r = checkFlowCodeLayers(map, os.tmpdir(), new Set(['app/controllers/a_controller.rb']))
    expect(r.findings.filter(f => f.kind === 'controller-without-route').map(f => f.detail)).toEqual([
      'codeUnit orphan: app/controllers/b_controller.rb serves no route in config/routes.rb',
    ])
  })
})
