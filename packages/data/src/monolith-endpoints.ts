import type { MonolithRoute, ServiceEndpoint } from '@dependency-explorer/schema'

export interface EndpointNote { description?: string; useCase?: string }

export function monolithEndpoints(routes: MonolithRoute[], notes: Record<string, EndpointNote>): ServiceEndpoint[] {
  return routes.map(r => {
    const id = `${r.verb} ${r.path}`
    return {
      id,
      path: r.path,
      method: r.verb,
      description: notes[id]?.description ?? `${r.controller}#${r.action}`,
      useCase: notes[id]?.useCase ?? '',
      params: [...r.path.matchAll(/:(\w+)/g)].map(m => ({ name: m[1] ?? '', in: 'path' as const, type: 'string', required: true, description: '' })),
      response: {},
      provenance: { source: 'discovered' as const, evidence: 'config/routes.rb' },
    }
  })
}
