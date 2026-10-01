import { describe, it, expect } from 'vitest'
import type { MonolithRoute } from '@dependency-explorer/schema'
import { monolithEndpoints } from './monolith-endpoints'

describe('monolithEndpoints', () => {
  const routes: MonolithRoute[] = [{ verb: 'PATCH', path: '/v3/api/shops/:shop_id/postes/:id', controller: 'v3/api/postes', action: 'update', controllerFile: 'app/controllers/v3/api/postes_controller.rb' }]

  it('builds endpoint entities with path params and a controller#action default description', () => {
    const [ep] = monolithEndpoints(routes, {})
    expect(ep?.id).toBe('PATCH /v3/api/shops/:shop_id/postes/:id')
    expect(ep?.description).toBe('v3/api/postes#update')
    expect(ep?.params.map(p => p.name)).toEqual(['shop_id', 'id'])
    expect(ep?.provenance?.source).toBe('discovered')
  })

  it('merges human notes by endpoint id', () => {
    const [ep] = monolithEndpoints(routes, { 'PATCH /v3/api/shops/:shop_id/postes/:id': { description: 'Rename or recolour a poste', useCase: 'Settings → postes' } })
    expect([ep?.description, ep?.useCase]).toEqual(['Rename or recolour a poste', 'Settings → postes'])
  })
})
