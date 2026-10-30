import type { MonolithRoute, ServiceEndpoint } from '@dependency-explorer/schema'

export function monolithEndpoints(routes: MonolithRoute[]): ServiceEndpoint[] {
  return routes.map(r => ({
    id: `${r.verb} ${r.path}`,
    path: r.path,
    method: r.verb,
    description: `${r.controller}#${r.action}`,
    useCase: '',
    params: [...r.path.matchAll(/:(\w+)/g)].map(m => ({ name: m[1] ?? '', in: 'path' as const, type: 'string', required: true, description: '' })),
    response: {},
    provenance: { source: 'discovered' as const, evidence: 'config/routes.rb' },
  }))
}
